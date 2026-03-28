import { INSTRUCTION_KEYWORDS } from '../shared/constants';

const B64_RE = /[A-Za-z0-9+/]{20,}={0,2}/g;

const COMMON_WORDS = new Set([
  'ignore',
  'disregard',
  'forget',
  'system',
  'prompt',
  'instruction',
  'override',
  'secret',
  'password',
  'exfiltrate',
  'previous',
  'rules',
]);

const CHAR_ARRAY_RE = /\[\s*['"]([a-zA-Z])['"]\s*(?:,\s*['"]([a-zA-Z])['"]\s*){3,}\]/g;

const MORSE_MAP = {
  '.-': 'A',
  '-...': 'B',
  '-.-.': 'C',
  '-..': 'D',
  '.': 'E',
  '..-.': 'F',
  '--.': 'G',
  '....': 'H',
  '..': 'I',
  '.---': 'J',
  '-.-': 'K',
  '.-..': 'L',
  '--': 'M',
  '-.': 'N',
  '---': 'O',
  '.--.': 'P',
  '--.-': 'Q',
  '.-.': 'R',
  '...': 'S',
  '-': 'T',
  '..-': 'U',
  '...-': 'V',
  '.--': 'W',
  '-..-': 'X',
  '-.--': 'Y',
  '--..': 'Z',
};

function reversedIsInteresting(word) {
  if (word.length < 4) return false;
  const rev = word.split('').reverse().join('').toLowerCase();
  if (COMMON_WORDS.has(rev)) return true;
  return INSTRUCTION_KEYWORDS.some((k) => rev.includes(k.replace(/\s+/g, '')));
}

function decodeMorseChunk(chunk) {
  const parts = chunk.trim().split(/\s+/);
  let out = '';
  for (const p of parts) {
    if (MORSE_MAP[p]) out += MORSE_MAP[p];
    else if (p === '/' || p === '|') out += ' ';
  }
  return out;
}

export function detectEncodings(text) {
  const findings = [];
  if (!text) return { encodingsFound: false, findings };

  let match;
  const b64re = new RegExp(B64_RE.source, B64_RE.flags);
  while ((match = b64re.exec(text)) !== null) {
    const seg = match[0];
    try {
      const bin = atob(seg.replace(/[^A-Za-z0-9+/]/g, ''));
      const printable = bin.replace(/[^\x20-\x7E]/g, '');
      if (/[a-zA-Z](?:[a-zA-Z ]{8,})/.test(printable)) {
        findings.push({
          type: 'base64',
          encoded: seg,
          decoded: printable.slice(0, 500),
          index: match.index,
        });
      }
    } catch {
      /* ignore */
    }
  }

  const care = new RegExp(CHAR_ARRAY_RE.source, CHAR_ARRAY_RE.flags);
  while ((match = care.exec(text)) !== null) {
    const inner = match[0].match(/['"]([a-zA-Z])['"]/g);
    if (inner && inner.length >= 4) {
      const decoded = inner.map((x) => x.replace(/['"]/g, '')).join('');
      findings.push({
        type: 'char_array',
        encoded: match[0],
        decoded,
        index: match.index,
      });
    }
  }

  const words = text.split(/\s+/);
  let revHits = 0;
  words.forEach((w) => {
    const clean = w.replace(/[^a-zA-Z]/g, '');
    if (reversedIsInteresting(clean)) revHits++;
  });
  if (revHits > 2) {
    findings.push({ type: 'reversed_words', count: revHits, decoded: null, index: 0 });
  }

  const pigLatinish = (text.match(/\b[bcdfghjklmnpqrstvwxyz]{1,3}[aeiou][a-z]*ay\b/gi) || []).length;
  if (pigLatinish > 3) {
    findings.push({ type: 'pig_latin_cluster', count: pigLatinish, decoded: null, index: 0 });
  }

  const morseLike = text.match(/(?:[.\-]{1,5}(?:\s+[.\-]{1,5}){3,})/g);
  if (morseLike) {
    morseLike.forEach((chunk, i) => {
      if (/[.\-]/.test(chunk) && chunk.length > 8) {
        const decoded = decodeMorseChunk(chunk);
        if (decoded.length >= 3) {
          findings.push({
            type: 'morse',
            encoded: chunk,
            decoded,
            index: text.indexOf(chunk) >= 0 ? text.indexOf(chunk) : i,
          });
        }
      }
    });
  }

  if (/['"][a-z0-9]+['"]\s*\+/.test(text) || /\]\s*\+\s*\[/.test(text)) {
    findings.push({ type: 'concat_pattern', encoded: text.slice(0, 120), decoded: null, index: 0 });
  }

  return { encodingsFound: findings.length > 0, findings };
}
