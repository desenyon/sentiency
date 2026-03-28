import { REMEDIATION_MODES } from '../../shared/constants';
import { storage } from '../../shared/storage';
import { buildSurgicalText, resolveRemovalSpans } from '../../shared/removal-spans';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHighlightHtml(original, spans) {
  if (!spans || !spans.length) return escapeHtml(original);
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let html = '';
  let i = 0;
  sorted.forEach((sp) => {
    const s = Math.max(0, sp.start | 0);
    const e = Math.max(s, sp.end | 0);
    html += escapeHtml(original.slice(i, s));
    html += `<mark data-sentientcy-injection="1" style="background:#ff4444;color:white;border-radius:3px;padding:0 2px">${escapeHtml(original.slice(s, e))}</mark>`;
    i = e;
  });
  html += escapeHtml(original.slice(i));
  return html;
}

export async function remediateDOM(element, threat) {
  const mode = (await storage.getRemediationMode()) || REMEDIATION_MODES.HIGHLIGHT;
  const raw = threat.originalText || element.textContent || '';
  const spans = resolveRemovalSpans(raw, threat);

  if (mode === REMEDIATION_MODES.SURGICAL) {
    const clean = buildSurgicalText(raw, spans);
    element.textContent = clean;
  } else if (mode === REMEDIATION_MODES.HIGHLIGHT) {
    element.innerHTML = buildHighlightHtml(raw, spans);
  } else if (mode === REMEDIATION_MODES.BLOCK) {
    element.textContent = `[Content blocked by Sentiency: ${threat.attackClass || 'Threat'} detected]`;
    element.setAttribute('style', 'color:#b91c1c;font-weight:600;');
  }

  element.setAttribute('data-sentientcy', 'remediated');
}
