import { REMEDIATION_MODES } from '../../shared/constants';
import { storage } from '../../shared/storage';
import { attachFieldHighlight, teardownFieldHighlight } from './field-highlighter';
import { buildSurgicalText, resolveRemovalSpans } from '../../shared/removal-spans';

function setInputValueNative(el, value) {
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) {
    desc.set.call(el, value);
    return true;
  }
  el.value = value;
  return true;
}

function insertTextInto(el, text) {
  teardownFieldHighlight(el);
  el.focus?.();

  if (el.isContentEditable) {
    const before = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    });
    if (!el.dispatchEvent(before)) return;
    if (document.execCommand('insertText', false, text)) {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return;
    }
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    return;
  }

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setInputValueNative(el, next);
    const pos = start + text.length;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function showFloatingWarning(target, threat, mode) {
  const id = 'sentientcy-float-warn';
  document.getElementById(id)?.remove();
  const box = document.createElement('div');
  box.id = id;
  box.setAttribute('data-sentientcy', 'overlay');
  box.className = 'sentientcy-float-toast';
  box.style.cssText =
    'position:fixed;z-index:2147483646;max-width:420px;padding:14px 16px;background:#0a0a0c;color:#e4e4ea;border:1px solid #f87171;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.75);font:13px/1.45 system-ui;animation:sentientcy-toast-in 0.35s ease-out both;';
  const r = target.getBoundingClientRect();
  box.style.left = `${Math.min(window.innerWidth - 430, Math.max(8, r.left))}px`;
  box.style.top = `${Math.max(8, r.top - 140)}px`;
  const sev = threat.severity || 'THREAT';
  const sub =
    mode === REMEDIATION_MODES.BLOCK
      ? 'Paste blocked — nothing was inserted.'
      : mode === REMEDIATION_MODES.SURGICAL
        ? 'Injection segments were removed; only the safe remainder was inserted into the field.'
        : 'Review the highlighted spans in the field.';
  box.innerHTML = `<strong style="color:#f87171">Sentiency</strong><div style="margin-top:8px;font-weight:600">${mode === REMEDIATION_MODES.BLOCK ? 'Paste blocked' : mode === REMEDIATION_MODES.SURGICAL ? 'Cleaned paste' : 'Injection flagged'}</div><div style="margin-top:6px;opacity:.9;font-size:12px">${sev} · ${(threat.taxonomyPath || []).slice(0, 3).join(' / ') || threat.attackClass || ''}</div><div style="margin-top:8px;font-size:11px;opacity:.85">${sub}</div>`;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 12000);
}

export async function remediateClipboard(originalText, threat, inputElement, forcedMode = null) {
  let mode = forcedMode;
  if (mode == null || !Object.values(REMEDIATION_MODES).includes(mode)) {
    mode = (await storage.getRemediationMode()) || REMEDIATION_MODES.SURGICAL;
  }

  if (mode === REMEDIATION_MODES.SURGICAL) {
    const spans = resolveRemovalSpans(originalText, threat);
    const clean = buildSurgicalText(originalText, spans);
    if (clean.length === 0 && originalText.length > 0) {
      insertTextInto(inputElement, originalText);
      showFloatingWarning(inputElement, threat, REMEDIATION_MODES.HIGHLIGHT);
      const hlSpans = resolveRemovalSpans(originalText, threat);
      attachFieldHighlight(inputElement, originalText, hlSpans, threat, REMEDIATION_MODES.HIGHLIGHT);
    } else {
      insertTextInto(inputElement, clean);
      showFloatingWarning(inputElement, threat, mode);
    }
  } else if (mode === REMEDIATION_MODES.HIGHLIGHT) {
    insertTextInto(inputElement, originalText);
    showFloatingWarning(inputElement, threat, mode);
    const hlSpans = resolveRemovalSpans(originalText, threat);
    attachFieldHighlight(inputElement, originalText, hlSpans, threat, mode);
  } else if (mode === REMEDIATION_MODES.BLOCK) {
    showFloatingWarning(inputElement, threat, mode);
  }

  inputElement.dispatchEvent(
    new CustomEvent('sentientcy-clipboard-remediated', {
      bubbles: true,
      detail: { threat, mode },
    }),
  );
}
