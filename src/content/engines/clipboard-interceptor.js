import { analyzeText, persistAndBroadcastThreat } from '../../pipeline/threat-pipeline';
import { remediateClipboard, showPasteNotice } from '../remediation/clipboard-remediator';
import { createPasteTransaction } from '../remediation/paste-transaction';
import { ENGINE, PASTE_MIN_CHARS_EDITABLE } from '../../shared/constants';
import { watchEngines, DEFAULT_ENGINES } from '../../shared/storage';
import { resolveInputRoot, isEditableTarget } from './input-resolve';
import { isSensitiveElement } from '../../shared/privacy';
import { setLastPasteContext } from '../clipboard-context';
import { emitContentEvent } from '../events';

function clipboardText(transfer) {
  // Rich HTML and image payloads retain native paste behavior. Explicit image scanning is in the sidebar.
  try { return transfer?.getData('text/plain') || ''; } catch { return ''; }
}

export function initClipboardInterceptor(platformInfo) {
  let engines = { ...DEFAULT_ENGINES };
  let stopped = false;
  const transactions = new Set();
  const stopSettings = watchEngines((value) => { engines = value; });
  let pair = null;
  let pairTimer;
  async function finish(root, text, transaction) {
    emitContentEvent('sentientcy-scan-busy', { phase: 'paste' });
    const isCurrent = () => !stopped && engines.clipboard && transaction.isCurrent();
    try {
      const threat = await analyzeText(text, ENGINE.CLIPBOARD, { skipPersist: true, isCurrent });
      if (!isCurrent()) return;
      if (!threat) { transaction.replace(text); return; }
      const result = await remediateClipboard(text, threat, root, null, transaction);
      if (!result.applied || !isCurrent()) return;
      setLastPasteContext(root, text, threat, transaction);
      await persistAndBroadcastThreat(threat, true);
      emitContentEvent('sentientcy-clipboard-risk', { threat, phase: 'paste' });
    } catch {
      if (isCurrent()) showPasteNotice(root, 'Analysis unavailable. Paste was paused; no clean verdict was produced.', () => {
        if (isCurrent()) transaction.replace(text);
      });
    } finally { emitContentEvent('sentientcy-scan-idle'); }
  }
  function intercept(event) {
    if (stopped || !engines.clipboard || !event.cancelable) return;
    if (event.type === 'beforeinput' && event.inputType !== 'insertFromPaste') return;
    const raw = event.composedPath?.()[0] || event.target;
    // Exclusions precede every clipboard/data read, even on platform-specific selectors.
    if (isSensitiveElement(raw)) return;
    const root = resolveInputRoot(raw, platformInfo);
    if (!isEditableTarget(root)) return;
    if (event.type === 'beforeinput' && pair?.root === root) {
      event.preventDefault(); event.stopImmediatePropagation(); pair = null;
      return;
    }
    const transfer = event.type === 'paste' ? event.clipboardData : event.dataTransfer;
    if ([...(transfer?.items || [])].some((item) => item.kind === 'file')) return;
    const text = event.type === 'paste' ? clipboardText(event.clipboardData)
      : typeof event.data === 'string' ? event.data : clipboardText(event.dataTransfer);
    if (text.length < PASTE_MIN_CHARS_EDITABLE) return;
    const tx = createPasteTransaction(root, () => transactions.delete(tx));
    if (!tx) return;
    // No await may occur before these calls: browser default actions are synchronous.
    event.preventDefault();
    event.stopImmediatePropagation();
    transactions.add(tx);
    if (event.type === 'paste') {
      pair = { root };
      clearTimeout(pairTimer);
      pairTimer = setTimeout(() => { pair = null; }, 0);
    }
    void finish(root, text, tx);
  }
  document.addEventListener('paste', intercept, true);
  document.addEventListener('beforeinput', intercept, true);
  return () => {
    stopped = true; stopSettings(); clearTimeout(pairTimer);
    document.removeEventListener('paste', intercept, true);
    document.removeEventListener('beforeinput', intercept, true);
    transactions.forEach((tx) => tx.dispose());
  };
}
