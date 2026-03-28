import { analyzeText } from '../../pipeline/threat-pipeline';
import { remediateClipboard } from '../remediation/clipboard-remediator';
import { ENGINE, PASTE_MIN_CHARS_EDITABLE } from '../../shared/constants';
import { storage } from '../../shared/storage';
import { resolveInputRoot, shouldAnalyzePaste, isEditableTarget } from './input-resolve';
import { setLastPasteContext } from '../clipboard-context';

function dispatchRisk(threat, phase) {
  window.dispatchEvent(new CustomEvent('sentientcy-clipboard-risk', { detail: { threat, phase } }));
}

function scanBusy(phase) {
  window.dispatchEvent(new CustomEvent('sentientcy-scan-busy', { detail: { phase } }));
}

function scanIdle() {
  window.dispatchEvent(new CustomEvent('sentientcy-scan-idle'));
}

let suppressPasteUntil = 0;

function insertPlain(el, text) {
  el.focus?.();
  const ev = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,
  });
  if (!el.dispatchEvent(ev)) return;
  if (document.execCommand('insertText', false, text)) return;
  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (sel.rangeCount) {
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
    }
  } else if ('value' in el) {
    const ta = el;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function finishPaste(inputRoot, text, platformInfo) {
  if (!inputRoot || !text) return;

  scanBusy('paste');
  try {
    const threat = await analyzeText(text, ENGINE.CLIPBOARD);
    if (!threat) {
      insertPlain(inputRoot, text);
      return;
    }
    await remediateClipboard(text, threat, inputRoot);
    setLastPasteContext(inputRoot, text, threat);
    dispatchRisk(threat, 'paste');
  } finally {
    scanIdle();
  }
}

async function handlePasteEvent(event, platformInfo) {
  const engines = await storage.getEngines();
  if (!engines.clipboard) return;

  if (Date.now() < suppressPasteUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const rawTarget = event.target;
  const inputRoot = resolveInputRoot(rawTarget, platformInfo);

  let text = '';
  try {
    text = event.clipboardData?.getData('text/plain') || '';
  } catch {
    text = '';
  }

  if (!shouldAnalyzePaste(rawTarget, platformInfo, text.length)) return;

  if (!text && navigator.clipboard?.readText) {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const t = await navigator.clipboard.readText();
      if (!shouldAnalyzePaste(rawTarget, platformInfo, t.length)) {
        insertPlain(inputRoot, t);
        return;
      }
      await finishPaste(inputRoot, t, platformInfo);
    } catch {
      /* no clipboard access */
    }
    return;
  }

  if (!text) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  await finishPaste(inputRoot, text, platformInfo);
}

function handleBeforeInput(event, platformInfo) {
  if (event.inputType !== 'insertFromPaste') return;

  const rawTarget = event.target;
  if (!rawTarget || rawTarget.nodeType !== 1) return;

  const inputRoot = resolveInputRoot(rawTarget, platformInfo);
  if (!isEditableTarget(inputRoot)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  suppressPasteUntil = Date.now() + 200;

  const clipPreview = typeof event.data === 'string' ? event.data : '';

  (async () => {
    const engines = await storage.getEngines();
    if (!engines.clipboard) {
      suppressPasteUntil = 0;
      return;
    }

    let text = clipPreview;
    if (!text && navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        text = '';
      }
    }

    if (!text || !shouldAnalyzePaste(rawTarget, platformInfo, text.length)) {
      if (text && text.length < PASTE_MIN_CHARS_EDITABLE) {
        insertPlain(inputRoot, text);
      }
      suppressPasteUntil = 0;
      return;
    }

    await finishPaste(inputRoot, text, platformInfo);
  })();
}

export function initClipboardInterceptor(platformInfo) {
  document.addEventListener('paste', (e) => handlePasteEvent(e, platformInfo), true);
  document.addEventListener('beforeinput', (e) => handleBeforeInput(e, platformInfo), true);
}
