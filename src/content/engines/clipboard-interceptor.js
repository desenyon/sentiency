import { analyzeText, analyzeImage } from '../../pipeline/threat-pipeline';
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

function getClipboardImageFile(dataTransfer) {
  if (!dataTransfer?.items) return null;
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const it = dataTransfer.items[i];
    if (it.kind === 'file' && typeof it.type === 'string' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = reader.result;
      if (typeof s !== 'string') {
        reject(new Error('read failed'));
        return;
      }
      const idx = s.indexOf(',');
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function isRichTextField(el) {
  return !!(el?.isContentEditable || el?.getAttribute?.('contenteditable') === 'true');
}

function insertImageIntoEditable(root, file) {
  const url = URL.createObjectURL(file);
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  try {
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0);
      if (root.contains(r.commonAncestorContainer)) {
        r.deleteContents();
        r.insertNode(img);
        r.setStartAfter(img);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else {
        root.appendChild(img);
      }
    } else {
      root.appendChild(img);
    }
  } catch {
    root.appendChild(img);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

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

/**
 * Clipboard image (+ optional text). Blocks paste until scan completes.
 */
async function finishPasteWithImage(inputRoot, imageFile, text) {
  scanBusy('paste');
  try {
    const mime = imageFile.type || 'image/png';
    const b64 = await blobToBase64(imageFile);
    const imgThreat = await analyzeImage(mime, b64, ENGINE.IMAGE, { dispatchWindowEvent: true });
    if (imgThreat) {
      dispatchRisk(imgThreat, 'paste');
      return;
    }

    const t = (text || '').trim();
    if (t.length >= PASTE_MIN_CHARS_EDITABLE) {
      const textThreat = await analyzeText(t, ENGINE.CLIPBOARD);
      if (textThreat) {
        await remediateClipboard(t, textThreat, inputRoot);
        setLastPasteContext(inputRoot, t, textThreat);
        dispatchRisk(textThreat, 'paste');
        return;
      }
      insertPlain(inputRoot, t);
    } else if (t.length > 0) {
      insertPlain(inputRoot, t);
    }

    if (isRichTextField(inputRoot)) {
      insertImageIntoEditable(inputRoot, imageFile);
    }
  } catch (e) {
    dispatchRisk(
      {
        id: `err-${Date.now()}`,
        timestamp: Date.now(),
        source: ENGINE.IMAGE,
        originalText: '',
        severity: 'LOW',
        attackClass: 'Image scan failed',
        technique: e?.message || String(e),
        taxonomyPath: [],
        confidence: 0,
        intent: null,
        reasoning: 'The image could not be analyzed. Check your API key and network.',
        injectionSpans: [],
        localSignals: {},
        geminiPartial: true,
      },
      'paste',
    );
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
  const imageFile = getClipboardImageFile(event.clipboardData);
  const editable = isEditableTarget(inputRoot);

  let text = '';
  try {
    text = event.clipboardData?.getData('text/plain') || '';
  } catch {
    text = '';
  }

  if (imageFile && editable) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await finishPasteWithImage(inputRoot, imageFile, text);
    return;
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
