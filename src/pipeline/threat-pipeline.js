import { threatMetadata } from '../shared/privacy';
import { TRAJECTORY_SCHEMA } from '../classifier/validate-response';
import { contentEvents } from '../content/events';
import { detectUnicodeAnomalies } from '../detectors/unicode-detector';
import { detectInstructionPatterns } from '../detectors/instruction-pattern';
import { detectEncodings } from '../detectors/encoding-detector';
import { unwrapObfuscation } from '../detectors/obfuscation-unwrapper';
import { buildSingleTurnPrompt } from '../classifier/prompts/single-turn-classify';
import {
  buildImageClassifyPrompt,
  buildImageTranscribePrompt,
} from '../classifier/prompts/image-classify';
import { buildTrajectoryPrompt } from '../classifier/prompts/trajectory-classify';
import {
  callGemini,
  callGeminiWithImage,
  GEMINI_CLASSIFIER_GENERATION,
  GEMINI_IMAGE_COMBINED_GENERATION,
  GEMINI_IMAGE_TRANSCRIBE_GENERATION,
  GEMINI_THINKING_HIGH,
} from '../classifier/gemini-client';
import {
  CLASSIFIER_RESPONSE_JSON_SCHEMA,
  CLASSIFIER_SYSTEM_INSTRUCTION,
  IMAGE_COMBINED_RESPONSE_JSON_SCHEMA,
  IMAGE_COMBINED_SYSTEM_INSTRUCTION,
  IMAGE_OCR_RESPONSE_JSON_SCHEMA,
  IMAGE_OCR_SYSTEM_INSTRUCTION,
} from '../classifier/gemini-schemas';
import { mapToTaxonomyPath } from './taxonomy-mapper';
import { scoreSeverity } from './severity-scorer';
import { CONFIDENCE_THRESHOLD, TRAJECTORY_WINDOW, ENGINE } from '../shared/constants';
import { storage } from '../shared/storage';
import { safeRuntimeSendMessage } from '../shared/extension-context';
import { mergeAndClampSpans } from '../shared/span-utils';
import { augmentInjectionSpans } from '../shared/removal-spans';

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Structured JSON schema uses empty string instead of null for optional fields. */
function emptyToNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : String(v);
}

export async function persistAndBroadcastThreat(threat, dispatchWindowEvent) {
  try { await storage.logThreat(threat); } catch { threat.persistenceError = true; }
  safeRuntimeSendMessage({ type: 'THREAT_DETECTED', threat: threatMetadata(threat) });
  if (dispatchWindowEvent) {
    try {
      contentEvents.dispatchEvent(new CustomEvent('sentientcy-threat-detected', { detail: threat }));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Prefer ordered transcription_blocks joined with \\n; else extracted_visible_text.
 * @param {Record<string, unknown>} parsed
 */
function canonicalTranscriptFromOcrJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  const blocks = Array.isArray(parsed.transcription_blocks) ? [...parsed.transcription_blocks] : [];
  if (blocks.length) {
    blocks.sort((a, b) => (Number(a.readingOrder) || 0) - (Number(b.readingOrder) || 0));
    return blocks.map((b) => (b && b.text != null ? String(b.text) : '')).join('\n');
  }
  if (parsed.extracted_visible_text == null) return '';
  return String(parsed.extracted_visible_text);
}

/**
 * Legacy single vision call: classify + extract in one shot (used as fallback).
 */
async function analyzeImageVisionSinglePass(mimeType, base64Data, source, threshold, dispatchWindowEvent, options = {}) {
  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  const prompt = buildImageClassifyPrompt();
  const gemini = await callGeminiWithImage(prompt, mimeType, base64Data, {
    generationConfig: {
      ...GEMINI_IMAGE_COMBINED_GENERATION,
      ...GEMINI_THINKING_HIGH,
      responseMimeType: 'application/json',
      responseJsonSchema: IMAGE_COMBINED_RESPONSE_JSON_SCHEMA,
    },
    requestExtras: {
      systemInstruction: { parts: [{ text: IMAGE_COMBINED_SYSTEM_INSTRUCTION }] },
    },
  });

  if (gemini?.networkError) {
    throw new Error(gemini.message || 'Image scan failed');
  }

  const geminiOk = gemini && !gemini.parseError && !gemini.networkError;
  const inj = geminiOk && gemini.injection_detected === true;
  const conf = geminiOk ? Number(gemini.confidence) || 0 : 0;

  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  if (!inj || conf < threshold) return null;

  const extracted =
    geminiOk && gemini.extracted_visible_text != null ? String(gemini.extracted_visible_text).trim() : '';
  const originalText = extracted || `[Image: ${mimeType || 'image'}]`;

  const [unicode, instruction, encoding] = await Promise.all([
    Promise.resolve(detectUnicodeAnomalies(originalText)),
    Promise.resolve(detectInstructionPatterns(originalText)),
    Promise.resolve(detectEncodings(originalText)),
  ]);

  let decodedText = originalText;
  if (encoding.findings && encoding.findings.length) {
    decodedText = unwrapObfuscation(originalText, encoding.findings);
  }

  const attackClass = geminiOk ? emptyToNull(gemini.attack_class) : null;
  const technique = geminiOk ? emptyToNull(gemini.technique) : null;
  const confidence = conf;
  const taxonomyPath = mapToTaxonomyPath(attackClass, technique);

  const localSignals = {
    unicodeAnomalies: unicode.anomaliesFound,
    encodingFindings: encoding.encodingsFound,
    suspicionScore: instruction.suspicionScore,
  };

  let injectionSpans = [];
  if (geminiOk && Array.isArray(gemini.injection_spans)) {
    injectionSpans = gemini.injection_spans.map((s) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: s.text,
    }));
  }
  injectionSpans = mergeAndClampSpans(injectionSpans, originalText.length);
  injectionSpans = augmentInjectionSpans(originalText, injectionSpans, instruction, encoding);

  const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;

  const threat = {
    id: newId(),
    timestamp: Date.now(),
    source,
    originalText,
    decodedText: decodedText !== originalText ? decodedText : null,
    attackClass,
    technique,
    taxonomyPath,
    confidence,
    severity: scoreSeverity(confidence, attackClass, localSignals),
    injectionSpans,
    intent: geminiOk ? emptyToNull(gemini.intent) : null,
    reasoning: geminiOk ? gemini.reasoning : 'Image classification',
    localSignals,
    geminiPartial: !geminiOk,
    previewImageDataUrl: dataUrl,
    imagePipeline: 'vision_single_pass',
  };

  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  if (!options.skipPersist) await persistAndBroadcastThreat(threat, dispatchWindowEvent);
  return threat;
}

/**
 * Vision-based scan (sidebar upload or clipboard image paste).
 * Primary path: dedicated OCR-style vision pass (temperature 0), then text classification on the
 * transcript so wording is not conflated with threat judgment. Falls back to a single vision call
 * when OCR JSON fails, transcript is empty but the model flags visual-only risk, or transcript
 * exists but text classification misses while visual-only risk is set.
 * @param {string} mimeType e.g. image/png
 * @param {string} base64Data raw base64 (no data: prefix)
 * @param {string} source ENGINE.IMAGE etc.
 * @param {{ dispatchWindowEvent?: boolean }} [options]
 */
export async function analyzeImage(mimeType, base64Data, source, options = {}) {
  const dispatchWindowEvent = options.dispatchWindowEvent !== false;
  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  if (!base64Data || typeof base64Data !== 'string') throw new AnalysisUnavailableError('empty_image');

  const settings = await storage.getSettings();
  const threshold = typeof settings.confidenceThreshold === 'number' ? settings.confidenceThreshold : CONFIDENCE_THRESHOLD;

  const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;

  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  const ocr = await callGeminiWithImage(buildImageTranscribePrompt(), mimeType, base64Data, {
    generationConfig: {
      ...GEMINI_IMAGE_TRANSCRIBE_GENERATION,
      ...GEMINI_THINKING_HIGH,
      responseMimeType: 'application/json',
      responseJsonSchema: IMAGE_OCR_RESPONSE_JSON_SCHEMA,
    },
    requestExtras: {
      systemInstruction: { parts: [{ text: IMAGE_OCR_SYSTEM_INSTRUCTION }] },
    },
  });

  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  if (ocr?.networkError) {
    throw new Error(ocr.message || 'Image scan failed');
  }

  let transcript = '';
  let suspectedVisualOnly = false;

  if (ocr && !ocr.parseError && !ocr.networkError) {
    transcript = canonicalTranscriptFromOcrJson(ocr);
    suspectedVisualOnly = ocr.suspected_visual_prompt_injection === true;
  }

  const transcriptTrim = transcript.trim();

  if (ocr && !ocr.parseError && transcriptTrim.length > 0) {
    const threat = await analyzeText(transcript, source, {
      forceClassifier: true,
      skipPersist: true,
      fromImageOcr: true,
      isCurrent: options.isCurrent,
    });
    if (threat) {
      threat.previewImageDataUrl = dataUrl;
      threat.imagePipeline = 'ocr_then_text';
      const ocrNote =
        ocr && !ocr.parseError && ocr.ocr_notes != null ? String(ocr.ocr_notes).trim() : '';
      const baseReason = threat.reasoning || '';
      let note = baseReason
        ? `${baseReason} [Pipeline: dedicated vision OCR, then text classifier.]`
        : '[Pipeline: dedicated vision OCR, then text classifier.]';
      if (ocrNote) note += ` [Image quality: ${ocrNote}]`;
      threat.reasoning = note;
      if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
      if (!options.skipPersist) await persistAndBroadcastThreat(threat, dispatchWindowEvent);
      return threat;
    }
  }

  if (ocr && !ocr.parseError && suspectedVisualOnly) {
    const fallback = await analyzeImageVisionSinglePass(
      mimeType,
      base64Data,
      source,
      threshold,
      dispatchWindowEvent,
      options,
    );
    if (fallback) return fallback;
  }

  if (!ocr || ocr.parseError) {
    return analyzeImageVisionSinglePass(mimeType, base64Data, source, threshold, dispatchWindowEvent, options);
  }

  return null;
}

/**
 * @param {string} text
 * @param {string} source ENGINE.*
 * @param {{
 *   forceClassifier?: boolean,
 *   skipPersist?: boolean,
 *   fromImageOcr?: boolean,
 * }} [options]
 */
export async function analyzeText(text, source, options = {}) {
  if (!text || !String(text).trim()) return null;
  if (typeof text !== 'string' || text.length > 50000) throw new AnalysisUnavailableError('input_limit');
  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');

  const settings = await storage.getSettings();
  const threshold = typeof settings.confidenceThreshold === 'number' ? settings.confidenceThreshold : CONFIDENCE_THRESHOLD;

  const [unicode, instruction, encoding] = await Promise.all([
    Promise.resolve(detectUnicodeAnomalies(text)),
    Promise.resolve(detectInstructionPatterns(text)),
    Promise.resolve(detectEncodings(text)),
  ]);

  let decodedText = text;
  if (encoding.findings && encoding.findings.length) {
    decodedText = unwrapObfuscation(text, encoding.findings);
  }

  const hasLocalSignal =
    unicode.anomaliesFound ||
    instruction.suspicionScore > 0.1 ||
    encoding.encodingsFound;

  const forceClassifier =
    !!options.forceClassifier ||
    source === ENGINE.CLIPBOARD ||
    source === ENGINE.SCAN ||
    source === ENGINE.COPY;

  let gemini = null;
  if (hasLocalSignal || text.length > 150 || forceClassifier) {
    const prompt = buildSingleTurnPrompt(text, decodedText !== text ? decodedText : null, {
      fromImageOcr: !!options.fromImageOcr,
    });
    if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
    gemini = await callGemini(prompt, {
      sourceText: text,
      generationConfig: {
        ...GEMINI_CLASSIFIER_GENERATION,
        ...GEMINI_THINKING_HIGH,
        responseMimeType: 'application/json',
        responseJsonSchema: CLASSIFIER_RESPONSE_JSON_SCHEMA,
      },
      requestExtras: {
        systemInstruction: { parts: [{ text: CLASSIFIER_SYSTEM_INSTRUCTION }] },
      },
    });
  }

  const geminiOk = gemini && !gemini.parseError && !gemini.networkError;
  const inj = geminiOk && gemini.injection_detected === true;
  const conf = geminiOk ? Number(gemini.confidence) || 0 : 0;

  const confirmed =
    (inj && conf >= threshold) || instruction.suspicionScore >= 0.8;

  if (options.isCurrent && !options.isCurrent()) throw new AnalysisUnavailableError('stale_target');
  if (!confirmed) {
    if (gemini?.networkError || gemini?.parseError) throw new AnalysisUnavailableError(gemini.code || 'classifier');
    return null;
  }

  const attackClass = geminiOk ? emptyToNull(gemini.attack_class) : null;
  const technique = geminiOk ? emptyToNull(gemini.technique) : null;
  const confidence = inj ? conf : Math.max(instruction.suspicionScore, threshold);
  const taxonomyPath = mapToTaxonomyPath(attackClass, technique);

  const localSignals = {
    unicodeAnomalies: unicode.anomaliesFound,
    encodingFindings: encoding.encodingsFound,
    suspicionScore: instruction.suspicionScore,
  };

  let injectionSpans = [];
  if (geminiOk && Array.isArray(gemini.injection_spans)) {
    injectionSpans = gemini.injection_spans.map((s) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: s.text,
    }));
  }
  injectionSpans = mergeAndClampSpans(injectionSpans, text.length);
  injectionSpans = augmentInjectionSpans(text, injectionSpans, instruction, encoding);

  const threat = {
    id: newId(),
    timestamp: Date.now(),
    source,
    originalText: text,
    decodedText: decodedText !== text ? decodedText : null,
    attackClass,
    technique,
    taxonomyPath,
    confidence,
    severity: scoreSeverity(confidence, attackClass, localSignals),
    injectionSpans,
    intent: geminiOk ? emptyToNull(gemini.intent) : null,
    reasoning: geminiOk ? gemini.reasoning : 'Heuristic/local signal detection',
    localSignals,
    geminiPartial: !geminiOk,
  };

  if (!options.skipPersist) {
    await persistAndBroadcastThreat(threat, true);
  }

  return threat;
}

export async function analyzeTrajectory(turns) {
  if (!turns || turns.length < 2) {
    return { trajectory_attack_detected: false, confidence: 0 };
  }
  const windowed = turns.slice(-TRAJECTORY_WINDOW);
  if (windowed.some((turn) => !['user', 'assistant'].includes(turn.role) || typeof turn.content !== 'string') || windowed.reduce((n, turn) => n + turn.content.length, 0) > 50000) return { status: 'unavailable', networkError: true, code: 'input_limit' };
  const prompt = buildTrajectoryPrompt(windowed);
  const result = await callGemini(prompt, { trajectoryCount: windowed.length, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: TRAJECTORY_SCHEMA } });
  if (result.networkError) return result;
  const offset = turns.length - windowed.length;
  return {
    ...result, windowStart: offset + 1,
    attack_began_at_turn: result.attack_began_at_turn == null ? null : result.attack_began_at_turn + offset,
    safe_truncation_point: result.safe_truncation_point == null ? null : result.safe_truncation_point + offset,
    compromised_turns: result.compromised_turns.map((n) => n + offset),
  };
}


export class AnalysisUnavailableError extends Error {
  constructor(code) {
    super(`Analysis unavailable (${code}). No clean verdict was produced.`);
    this.name = 'AnalysisUnavailableError';
    this.code = code;
  }
}
/** Structured adapter for callers that need explicit states without exceptions. */
export async function analyzeTextResult(text, source, options = {}) {
  try {
    const threat = await analyzeText(text, source, options);
    return { status: threat ? 'threat' : 'no_threat_detected', threat };
  } catch (error) {
    return { status: 'unavailable', code: error.code || 'analysis_failed', threat: null };
  }
}
