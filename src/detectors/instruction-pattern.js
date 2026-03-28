import { INSTRUCTION_KEYWORDS } from '../shared/constants';

const IMPERATIVE_RE =
  /(?:^|[.!?\n]\s*)(ignore|disregard|forget|override|bypass|pretend|respond\s+as|you\s+must|do\s+not|stop\s+being|act\s+as)\b/gi;

export function detectInstructionPatterns(text) {
  const keywordMatches = [];
  const lower = text.toLowerCase();
  INSTRUCTION_KEYWORDS.forEach((kw) => {
    let idx = 0;
    while (idx < lower.length) {
      const i = lower.indexOf(kw, idx);
      if (i === -1) break;
      keywordMatches.push({ keyword: kw, index: i });
      idx = i + kw.length;
    }
  });

  const imperativeMatches = [];
  let m;
  const re = new RegExp(IMPERATIVE_RE.source, IMPERATIVE_RE.flags);
  while ((m = re.exec(text)) !== null) {
    imperativeMatches.push({ match: m[0], index: m.index });
  }

  let suspicionScore = Math.min(
    1,
    keywordMatches.length * 0.3 + imperativeMatches.length * 0.2,
  );

  return { keywordMatches, imperativeMatches, suspicionScore };
}
