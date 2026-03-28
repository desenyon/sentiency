/**
 * Detects labeled injection blocks like:
 * [Injected Instruction - Type: Role Confusion]
 * ...body until the next [Document …] or [Injected Instruction …] section.
 * Preserves [Document N] and other non-injection bracket sections.
 */

const INJECTION_HEADER =
  /\[\s*(?:Injected\s+Instruction|INJECTED\s+INSTRUCTION)[^\]\r\n]*\]/gi;

/** Next line-start section that begins a new bracket block we care about */
const NEXT_SECTION = /\r?\n\[\s*(?:Injected\s+Instruction|INJECTED\s+INSTRUCTION|Document\b)/gi;

export function collectBracketInjectionSpans(text) {
  if (!text || typeof text !== 'string') return [];

  const spans = [];
  let m;
  const re = new RegExp(INJECTION_HEADER.source, INJECTION_HEADER.flags);
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const headerEnd = m.index + m[0].length;
    const slice = text.slice(headerEnd);
    NEXT_SECTION.lastIndex = 0;
    const next = NEXT_SECTION.exec(slice);
    let end = next ? headerEnd + next.index : text.length;
    while (end > start && /\s/.test(text[end - 1])) end -= 1;
    if (end > start) {
      spans.push({ start, end, text: '' });
    }
  }
  return spans;
}
