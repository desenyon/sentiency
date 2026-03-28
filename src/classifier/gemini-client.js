import { GEMINI_API_URL } from '../shared/constants';
import { storage } from '../shared/storage';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripCodeFences(s) {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

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

function shallowCloneParts(parts) {
  return (parts || []).map((p) => {
    if (!p || typeof p !== 'object') return p;
    const next = { ...p };
    if (p.inlineData) next.inlineData = { ...p.inlineData };
    return next;
  });
}

function stripMediaResolutionFromParts(parts) {
  return parts.map((p) => {
    if (!p?.inlineData || p.mediaResolution == null) return p;
    const { mediaResolution: _m, ...rest } = p;
    return rest;
  });
}

function partsHaveMediaResolution(parts) {
  return parts.some((p) => p?.inlineData && p.mediaResolution != null);
}

/**
 * Final answer text only (Gemini 3 may emit separate "thought" parts).
 * @param {unknown[]} parts
 */
function partsToAnswerText(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && p.thought !== true && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

/**
 * @param {unknown[]} parts
 * @param {Record<string, unknown> | null} genOverrides
 * @param {Record<string, unknown> | null} requestExtras e.g. { systemInstruction: { parts: [{ text }] } }
 */
async function postGeminiContents(parts, genOverrides = null, requestExtras = null) {
  const key = await storage.getApiKey();
  if (!key) {
    return { networkError: true, message: 'No API key configured' };
  }

  const url = `${GEMINI_API_URL}?key=${encodeURIComponent(key)}`;
  let lastErr;

  for (let attempt = 0; attempt < 3; attempt++) {
    let tryGen = { ...DEFAULT_GENERATION, ...(genOverrides || {}) };
    let tryParts = shallowCloneParts(parts);

    for (let relax = 0; relax < 8; relax++) {
      const body = {
        contents: [{ parts: tryParts }],
        generationConfig: tryGen,
        ...(requestExtras && typeof requestExtras === 'object' ? requestExtras : {}),
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          lastErr = json?.error?.message || res.statusText;
          if (res.status === 400) {
            if (tryGen.responseJsonSchema != null || tryGen.responseMimeType != null) {
              tryGen = { ...tryGen };
              delete tryGen.responseJsonSchema;
              delete tryGen.responseMimeType;
              continue;
            }
            if (tryGen.thinkingConfig != null) {
              tryGen = { ...tryGen };
              delete tryGen.thinkingConfig;
              continue;
            }
            if (partsHaveMediaResolution(tryParts)) {
              tryParts = stripMediaResolutionFromParts(tryParts);
              continue;
            }
          }
          break;
        }

        const rawText = partsToAnswerText(json?.candidates?.[0]?.content?.parts) || '';
        const cleaned = stripCodeFences(rawText);
        try {
          return JSON.parse(cleaned);
        } catch {
          return { parseError: true, raw: cleaned };
        }
      } catch (e) {
        lastErr = e.message;
        break;
      }
    }

    await sleep(1000 * 2 ** attempt);
  }

  return { networkError: true, message: lastErr || 'Gemini request failed' };
}

/**
 * @param {string} promptText
 * @param {{
 *   generationConfig?: Record<string, unknown>,
 *   requestExtras?: Record<string, unknown>,
 * }} [options]
 */
export async function callGemini(promptText, options = {}) {
  return postGeminiContents([{ text: promptText }], options.generationConfig ?? null, options.requestExtras ?? null);
}

/**
 * Multimodal: one inline image + instruction text.
 * Image is sent first by default (stronger visual grounding for OCR-style tasks).
 * @param {{
 *   generationConfig?: Record<string, unknown>,
 *   requestExtras?: Record<string, unknown>,
 *   imageFirst?: boolean,
 *   mediaLevel?: string,
 * }} [options]
 */
export async function callGeminiWithImage(promptText, mimeType, base64Data, options = {}) {
  const mime = mimeType || 'image/png';
  const imageFirst = options.imageFirst !== false;
  const level = options.mediaLevel ?? GEMINI_VISION_MEDIA_LEVEL_ULTRA;

  const imagePart = {
    inlineData: {
      mimeType: mime,
      data: base64Data,
    },
    mediaResolution: {
      level,
    },
  };

  const textPart = { text: promptText };
  const ordered = imageFirst ? [imagePart, textPart] : [textPart, imagePart];

  return postGeminiContents(ordered, options.generationConfig ?? null, options.requestExtras ?? null);
}
