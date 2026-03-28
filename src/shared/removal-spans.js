import { detectInstructionPatterns } from '../detectors/instruction-pattern';
import { detectEncodings } from '../detectors/encoding-detector';
import { collectBracketInjectionSpans } from '../detectors/injection-block-spans';
import { buildHeuristicSpans, mergeAndClampSpans } from './span-utils';

function spansFromEncodingFindings(text, encodingResult) {
  const out = [];
  const findings = encodingResult?.findings || [];
  const len = text.length;
  for (const f of findings) {
    if (!f || typeof f.index !== 'number') continue;
    if (f.type === 'reversed_words' || f.type === 'pig_latin_cluster' || f.type === 'concat_pattern') continue;
    if (typeof f.encoded === 'string' && f.encoded.length > 0) {
      const e = Math.min(len, f.index + f.encoded.length);
      if (e > f.index) out.push({ start: f.index, end: e, text: '' });
    }
  }
  return out;
}

/**
 * Merge model spans with bracketed injection blocks, encoding segments, and keyword/imperative hits.
 */
export function augmentInjectionSpans(plainText, baseSpans, instructionResult, encodingResult) {
  if (!plainText) return [];
  const parts = [...(baseSpans || [])];
  parts.push(...collectBracketInjectionSpans(plainText));
  parts.push(...spansFromEncodingFindings(plainText, encodingResult));
  if (instructionResult) {
    parts.push(...buildHeuristicSpans(plainText, instructionResult));
  }
  return mergeAndClampSpans(parts, plainText.length);
}

/**
 * Full resolution for a stored threat + plain text (paste field, DOM snapshot, panel preview).
 */
export function resolveRemovalSpans(plainText, threat) {
  const base = threat?.injectionSpans || [];
  const instructionResult = detectInstructionPatterns(plainText);
  const encodingResult = detectEncodings(plainText);
  return augmentInjectionSpans(plainText, base, instructionResult, encodingResult);
}

export function buildSurgicalText(plainText, spans) {
  if (!plainText || !spans || !spans.length) return plainText || '';
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let i = 0;
  for (const sp of sorted) {
    const s = Math.max(0, sp.start | 0);
    const e = Math.max(s, sp.end | 0);
    out += plainText.slice(i, s);
    i = e;
  }
  out += plainText.slice(i);
  return out;
}
