function parseRgb(color) {
  if (!color || color === 'transparent') return null;
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function colorDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

export function analyzeVisibility(element) {
  const flags = [];
  if (!element || element.nodeType !== 1) {
    return { isHidden: false, flags, text: '' };
  }

  const style = window.getComputedStyle(element);
  const text = (element.textContent || '').trim();

  if (style.display === 'none') flags.push('display-none');
  if (style.visibility === 'hidden') flags.push('visibility-hidden');
  const opacity = parseFloat(style.opacity);
  if (!Number.isNaN(opacity) && opacity === 0) flags.push('opacity-zero');

  const fontSize = parseFloat(style.fontSize);
  if (!Number.isNaN(fontSize) && fontSize < 2) flags.push('tiny-font');

  const fg = parseRgb(style.color);
  const bg = parseRgb(style.backgroundColor);
  if (fg && bg && colorDistance(fg, bg) <= 30) flags.push('fg-bg-match');

  const clip = style.clip;
  const clipPath = style.clipPath;
  if ((clip && clip !== 'auto' && clip !== 'rect(auto, auto, auto, auto)') || (clipPath && clipPath !== 'none')) {
    flags.push('clip-hidden');
  }

  if (style.position === 'absolute') {
    const top = parseFloat(style.top);
    const left = parseFloat(style.left);
    if (!Number.isNaN(top) && top < -500) flags.push('offscreen-top');
    if (!Number.isNaN(left) && left < -500) flags.push('offscreen-left');
  }

  const ti = parseFloat(style.textIndent);
  if (!Number.isNaN(ti) && Math.abs(ti) > 9999) flags.push('text-indent-offscreen');

  const rect = element.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (text.length > 0 && (w === 0 || h === 0)) flags.push('zero-box-with-text');

  return {
    isHidden: flags.length > 0,
    flags,
    text,
  };
}
