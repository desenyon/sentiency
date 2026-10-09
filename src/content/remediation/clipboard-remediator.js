import { REMEDIATION_MODES } from '../../shared/constants';
import { storage } from '../../shared/storage';
import { resolveRemovalSpans, buildSurgicalText } from '../../shared/removal-spans';
import { createPasteTransaction } from './paste-transaction';
import { emitContentEvent } from '../events';

export function showPasteNotice(target, message, action) {
  document.getElementById('sentientcy-float-warn')?.remove();
  const box = document.createElement('div');
  box.id = 'sentientcy-float-warn';
  box.setAttribute('data-sentientcy', 'overlay');
  box.setAttribute('role', 'status');
  box.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:2147483646;max-width:420px;padding:16px;background:#111;color:#fff;border:1px solid #f87171;border-radius:12px;font:13px/1.5 system-ui';
  const title = document.createElement('strong');
  title.textContent = 'Sentiency';
  const description = document.createElement('p');
  description.textContent = message;
  box.append(title, description);
  if (action) {
    const button = document.createElement('button');
    button.textContent = 'Insert without verification';
    button.addEventListener('click', () => { action(); box.remove(); }, { once: true });
    box.appendChild(button);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 15000);
}

export async function remediateClipboard(originalText, threat, inputElement, forcedMode = null, transaction = null) {
  const mode = Object.values(REMEDIATION_MODES).includes(forcedMode) ? forcedMode : await storage.getRemediationMode();
  const tx = transaction || createPasteTransaction(inputElement);
  if (!tx?.isCurrent()) return { applied: false, reason: 'stale', transaction: tx };
  const spans = resolveRemovalSpans(originalText, threat);
  // A confirmed threat without usable spans must not pass through surgical mode unchanged.
  const clean = spans.length ? buildSurgicalText(originalText, spans) : '';
  const applied = mode === REMEDIATION_MODES.BLOCK ? tx.undo() : tx.replace(mode === REMEDIATION_MODES.SURGICAL ? clean : originalText);
  if (applied) {
    const message = mode === REMEDIATION_MODES.BLOCK ? 'Paste blocked; the original selection was preserved.'
      : mode === REMEDIATION_MODES.SURGICAL ? 'Flagged spans removed. Review the remaining text; it is not guaranteed safe.'
        : 'Original paste inserted for review. This field contains flagged content.';
    showPasteNotice(inputElement, `${message} ${threat.attackClass || ''}`);
    emitContentEvent('sentientcy-clipboard-remediated', { threat, mode });
  }
  return { applied, transaction: tx, mode };
}
