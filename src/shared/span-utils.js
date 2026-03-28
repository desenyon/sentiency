export function mergeAndClampSpans(spans, maxLen) {
  const valid = (spans || [])
    .map((s) => {
      const start = Math.max(0, Math.min(Number(s.start) || 0, maxLen));
      const end = Math.max(0, Math.min(Number(s.end) || 0, maxLen));
      return { start, end };
    })
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const s of valid) {
    const last = merged[merged.length - 1];
    if (!last || s.start > last.end) merged.push({ start: s.start, end: s.end });
    else last.end = Math.max(last.end, s.end);
  }
  return merged.map((s) => ({
    start: s.start,
    end: s.end,
    text: '',
  }));
}

export function buildHeuristicSpans(text, instruction) {
  if (!text || !instruction) return [];
  const spans = [];
  (instruction.keywordMatches || []).forEach((m) => {
    const len = m.keyword.length;
    spans.push({ start: m.index, end: m.index + len });
  });
  (instruction.imperativeMatches || []).forEach((m) => {
    spans.push({ start: m.index, end: m.index + m.match.length });
  });
  return mergeAndClampSpans(spans, text.length);
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function spansToHighlightedHtml(plainText, spans) {
  const sorted = mergeAndClampSpans(spans, plainText.length);
  let html = '';
  let i = 0;
  sorted.forEach((sp) => {
    html += escapeHtml(plainText.slice(i, sp.start));
    html += `<mark class="sentientcy-hl-mark" data-sentientcy="hl">${escapeHtml(plainText.slice(sp.start, sp.end))}</mark>`;
    i = sp.end;
  });
  html += escapeHtml(plainText.slice(i));
  return html;
}
