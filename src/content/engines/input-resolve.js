import { PASTE_MIN_CHARS_EDITABLE } from '../../shared/constants';

const SKIP_INPUT_TYPES = new Set(['button', 'submit', 'checkbox', 'radio', 'file', 'hidden', 'image', 'reset', 'range', 'color']);

function isOurUi(el) {
  return !!el?.closest?.('#sentientcy-host');
}

export function isEditableTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  if (isOurUi(el)) return false;

  if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') {
    const root = el.closest?.('[contenteditable="true"]') || el;
    if (isOurUi(root)) return false;
    return true;
  }

  if (el.tagName === 'TEXTAREA') {
    return !el.disabled && !el.readOnly && !isOurUi(el);
  }

  if (el.tagName === 'INPUT') {
    if (el.disabled || el.readOnly) return false;
    if (isOurUi(el)) return false;
    const t = (el.type || 'text').toLowerCase();
    if (SKIP_INPUT_TYPES.has(t)) return false;
    return true;
  }

  return false;
}

export function matchesInputArea(target, selectorString) {
  if (!target || !selectorString) return false;
  const parts = selectorString.split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    try {
      if (target.matches?.(p)) return true;
      if (target.closest?.(p)) return true;
    } catch {
      /* invalid selector */
    }
  }
  return false;
}

export function resolveInputRoot(target, platformInfo) {
  if (!target || target.nodeType !== 1) return target;

  const sel = platformInfo?.selectors?.inputField;
  if (sel && target.closest) {
    const parts = sel.split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      try {
        const hit = target.closest(p);
        if (hit) return hit;
      } catch {
        /* ignore */
      }
    }
  }

  const ce = target.closest?.('[contenteditable="true"]');
  if (ce) return ce;

  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return target;

  let p = target.parentElement;
  while (p && p !== document.body) {
    if (p.tagName === 'TEXTAREA') return p;
    if (p.tagName === 'INPUT' && isEditableTarget(p)) return p;
    p = p.parentElement;
  }

  return target;
}

export function shouldAnalyzePaste(rawTarget, platformInfo, clipLen) {
  const root = resolveInputRoot(rawTarget, platformInfo);
  if (!isEditableTarget(root)) return false;
  return clipLen >= PASTE_MIN_CHARS_EDITABLE;
}
