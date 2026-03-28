import { ENGINE } from './constants';

/** Human-readable labels for `threat.source` / ENGINE values */
export const ENGINE_LABELS = {
  [ENGINE.DOM]: 'DOM Scanner',
  [ENGINE.CLIPBOARD]: 'Clipboard Interceptor',
  [ENGINE.SESSION]: 'Session Monitor',
  [ENGINE.COPY]: 'Copy Guard',
  [ENGINE.SCAN]: 'Selection Scan',
  [ENGINE.IMAGE]: 'Image scan',
};

export function threatSourceLabel(source) {
  return ENGINE_LABELS[source] || String(source || 'Unknown');
}

/**
 * Heuristic for taxonomy/model output that points at visual/multimodal attacks
 * (steganography, OCR exploits, cross-modal instructions).
 */
export function threatHasVisualMultimodalSignals(threat) {
  if (!threat) return false;
  const blob = [...(threat.taxonomyPath || []), threat.attackClass, threat.technique, threat.intent]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /multimodal|stegan|ocr|visual prompt|imagery|\bimage\b|cross-modal/.test(blob);
}
