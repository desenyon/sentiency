import { GEMINI_API_URL } from '../shared/constants';
import { storage } from '../shared/storage';
import { CLASSIFIER_RESPONSE_JSON_SCHEMA } from './gemini-schemas';
import { validateClassifier, validateTrajectory } from './validate-response';

const DEFAULT_GENERATION = {
  temperature: 0.1,
  topP: 0.95,
  maxOutputTokens: 2048,
};

/** Gemini 3.x: maximize reasoning depth for security tasks (API may ignore on some models). */
export const GEMINI_THINKING_HIGH = {
  thinkingConfig: {
    thinkingLevel: 'high',
  },
};

/** Vision OCR: minimize paraphrase / hallucinated wording (classification uses a separate text call). */
export const GEMINI_IMAGE_TRANSCRIBE_GENERATION = {
  temperature: 0,
  topP: 0.85,
  maxOutputTokens: 8192,
};

/** Single-call image classify (fallback): still cooler than default to reduce transcript drift. */
export const GEMINI_IMAGE_COMBINED_GENERATION = {
  temperature: 0.05,
  topP: 0.9,
  maxOutputTokens: 8192,
};

/** Text classifier: slightly more headroom for JSON + reasoning. */
export const GEMINI_CLASSIFIER_GENERATION = {
  temperature: 0.1,
  topP: 0.9,
  maxOutputTokens: 4096,
};

/** Default: prefer maximum detail for small security crops (API may fall back on unsupported models). */
export const GEMINI_VISION_MEDIA_LEVEL_ULTRA = 'MEDIA_RESOLUTION_ULTRA_HIGH';

export const REQUEST_DEADLINE_MS = 12000;
export function unavailable(code) {
  return { status: 'unavailable', code, networkError: true, message: `Analysis unavailable (${code}). No clean verdict was produced.` };
}

/** Worker-only transport. No raw provider errors or unvalidated response text escape. */
export async function executeGeminiRequest(parts, options = {}) {
  const controller = new AbortController();
  let timer;
  const operation = async () => {
    const settings = await storage.getSettings();
    if (!settings.remoteAnalysisEnabled) return unavailable('remote_disabled');
    const key = await storage.getApiKey();
    if (!key) return unavailable('missing_key');
    if (JSON.stringify(parts).length > 6000000) return unavailable('input_limit');
    const schema = options.generationConfig?.responseJsonSchema || CLASSIFIER_RESPONSE_JSON_SCHEMA;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (controller.signal.aborted) return unavailable('timeout');
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { ...DEFAULT_GENERATION, ...options.generationConfig },
          ...(options.requestExtras?.systemInstruction ? { systemInstruction: options.requestExtras.systemInstruction } : {}),
        }),
      });
      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
        return unavailable(`http_${response.status}`);
      }
      const envelope = await response.json();
      const candidate = envelope?.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') return unavailable('incomplete_response');
      const raw = (candidate?.content?.parts || []).filter((part) => !part.thought && typeof part.text === 'string').map((part) => part.text).join('');
      if (raw.length > 150000) return unavailable('response_limit');
      let parsed;
      try { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
      catch { return unavailable('invalid_json'); }
      const valid = options.trajectoryCount
        ? validateTrajectory(parsed, options.trajectoryCount)
        : validateClassifier(parsed, schema, options.sourceText);
      if (!valid) return unavailable('invalid_schema');
      const keys = options.trajectoryCount ? ['trajectory_attack_detected', 'confidence', 'attack_type', 'attack_began_at_turn', 'compromised_turns', 'description', 'safe_truncation_point'] : Object.keys(schema.properties);
      return { ...Object.fromEntries(keys.filter((key) => key in parsed).map((key) => [key, parsed[key]])), status: 'complete' };
    }
    return unavailable('network');
  };
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(unavailable('timeout')); }, REQUEST_DEADLINE_MS);
  });
  try { return await Promise.race([operation().catch(() => unavailable(controller.signal.aborted ? 'timeout' : 'network')), deadline]); }
  finally { clearTimeout(timer); }
}

function request(parts, options) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(unavailable('worker_timeout')), REQUEST_DEADLINE_MS + 2000);
    try {
      chrome.runtime.sendMessage({ type: 'CLASSIFY', parts, options }, (result) => {
        clearTimeout(timer);
        resolve(chrome.runtime.lastError || !result ? unavailable('worker') : result);
      });
    } catch { clearTimeout(timer); resolve(unavailable('worker')); }
  });
}
export function callGemini(promptText, options = {}) {
  return request([{ text: promptText }], options);
}
export function callGeminiWithImage(promptText, mimeType, base64Data, options = {}) {
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mimeType) || base64Data.length > 5592408) {
    return Promise.resolve(unavailable('image_limit_or_type'));
  }
  return request([{ inlineData: { mimeType, data: base64Data } }, { text: promptText }], options);
}
