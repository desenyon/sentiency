import { ZERO_WIDTH_CHARS } from '../shared/constants';

const RTL_OVERRIDE = ['\u202E', '\u202D'];

const UNUSUAL_WS = new Set([
  '\u00A0',
  '\u1680',
  '\u2000',
  '\u2001',
  '\u2002',
  '\u2003',
  '\u2004',
  '\u2005',
  '\u2006',
  '\u2007',
  '\u2008',
  '\u2009',
  '\u200A',
  '\u202F',
  '\u205F',
  '\u3000',
]);

function countScript(text, re) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (re.test(text[i])) n++;
  }
  return n;
}

const reLatin = /[A-Za-z]/;
const reCyrillic = /[\u0400-\u04FF]/;
const reGreek = /[\u0370-\u03FF]/;

export function detectUnicodeAnomalies(text) {
  const findings = [];
  if (!text) return { anomaliesFound: false, findings };

  let zw = 0;
  ZERO_WIDTH_CHARS.forEach((ch) => {
    const c = (text.split(ch).length - 1);
    if (c) {
      zw += c;
    }
  });
  if (zw) findings.push({ type: 'zero_width', count: zw });

  let rtl = 0;
  RTL_OVERRIDE.forEach((ch) => {
    rtl += text.split(ch).length - 1;
  });
  if (rtl) findings.push({ type: 'rtl_override', count: rtl });

  const latin = countScript(text, reLatin);
  const cyr = countScript(text, reCyrillic);
  const gr = countScript(text, reGreek);
  if (latin > 5 && cyr > 0) findings.push({ type: 'cyrillic_in_latin', latin, cyr });
  if (latin > 5 && gr > 0) findings.push({ type: 'greek_in_latin', latin, gr });

  let unusual = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r' && /\s/.test(ch)) {
      if (UNUSUAL_WS.has(ch)) unusual++;
    }
  }
  if (unusual) findings.push({ type: 'unusual_whitespace', count: unusual });

  return { anomaliesFound: findings.length > 0, findings };
}
