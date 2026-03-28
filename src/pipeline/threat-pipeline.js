import { detectUnicodeAnomalies } from '../detectors/unicode-detector';
import { detectInstructionPatterns } from '../detectors/instruction-pattern';
import { detectEncodings } from '../detectors/encoding-detector';
import { unwrapObfuscation } from '../detectors/obfuscation-unwrapper';
import { buildSingleTurnPrompt } from '../classifier/prompts/single-turn-classify';
import { buildTrajectoryPrompt } from '../classifier/prompts/trajectory-classify';
import { callGemini } from '../classifier/gemini-client';
import { mapToTaxonomyPath } from './taxonomy-mapper';
import { scoreSeverity } from './severity-scorer';
import { CONFIDENCE_THRESHOLD, TRAJECTORY_WINDOW, ENGINE } from '../shared/constants';
import { storage } from '../shared/storage';
import { mergeAndClampSpans } from '../shared/span-utils';
import { augmentInjectionSpans } from '../shared/removal-spans';

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export async function analyzeText(text, source, options = {}) {
  if (!text || !String(text).trim()) return null;

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
    const prompt = buildSingleTurnPrompt(text, decodedText !== text ? decodedText : null);
    gemini = await callGemini(prompt);
  }

  const geminiOk = gemini && !gemini.parseError && !gemini.networkError;
  const inj = geminiOk && gemini.injection_detected === true;
  const conf = geminiOk ? Number(gemini.confidence) || 0 : 0;

  const confirmed =
    (inj && conf >= threshold) || instruction.suspicionScore >= 0.8;

  if (!confirmed) return null;

  const attackClass = geminiOk ? gemini.attack_class : null;
  const technique = geminiOk ? gemini.technique : null;
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
    intent: geminiOk ? gemini.intent : null,
    reasoning: geminiOk ? gemini.reasoning : 'Heuristic/local signal detection',
    localSignals,
    geminiPartial: !geminiOk,
  };

  await storage.logThreat(threat);
  try {
    chrome.runtime.sendMessage({ type: 'THREAT_DETECTED', threat }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('sentientcy-threat-detected', { detail: threat }));
  } catch {
    /* ignore */
  }

  return threat;
}

export async function analyzeTrajectory(turns) {
  if (!turns || turns.length < 2) {
    return { trajectory_attack_detected: false, confidence: 0 };
  }
  const windowed = turns.slice(-TRAJECTORY_WINDOW);
  const prompt = buildTrajectoryPrompt(windowed);
  return callGemini(prompt);
}
