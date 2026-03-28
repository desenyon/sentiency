import { ZERO_WIDTH_CHARS, HOMOGLYPH_MAP } from '../shared/constants';

export function unwrapObfuscation(text, encodingFindings) {
  let out = text || '';
  if (encodingFindings && encodingFindings.length) {
    const sorted = [...encodingFindings].filter((f) => f.encoded && typeof f.encoded === 'string').sort((a, b) => b.encoded.length - a.encoded.length);
    sorted.forEach((f) => {
      if (f.decoded && typeof f.decoded === 'string' && f.encoded) {
        out = out.split(f.encoded).join(f.decoded);
      }
    });
  }
  let normalized = '';
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    normalized += HOMOGLYPH_MAP[ch] || ch;
  }
  ZERO_WIDTH_CHARS.forEach((z) => {
    normalized = normalized.split(z).join('');
  });
  return normalized;
}
