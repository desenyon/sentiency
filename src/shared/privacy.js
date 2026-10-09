import { TAXONOMY_CLASS_NAMES } from './taxonomy';

const CREDENTIAL_HINT = /username|password|passwd|passphrase|secret|api[\s_-]*key|access[\s_-]*token|auth[\s_-]*token|one[\s_-]*time|otp|verification[\s_-]*code|credit[\s_-]*card|card[\s_-]*number|security[\s_-]*code|cvv|cvc/i;
const PRIVATE_AUTOCOMPLETE = /(?:^|\s)(?:username|current-password|new-password|one-time-code|cc-\S+)(?:\s|$)/i;

function hasCredentialHint(el) {
  if (el?.nodeType !== 1) return false;
  if (el.matches('input[type="password"], [data-sentiency-private], [data-private]')) return true;
  if (PRIVATE_AUTOCOMPLETE.test(el.getAttribute('autocomplete') || '')) return true;
  const hints = ['name', 'id', 'aria-label', 'placeholder'].map((a) => el.getAttribute(a) || '').join(' ');
  if (CREDENTIAL_HINT.test(hints)) return true;
  return [...(el.labels || [])].some((label) => CREDENTIAL_HINT.test(label.textContent || ''));
}

/** Conservative exclusion. This is a field boundary, not a general secret detector. */
export function isSensitiveElement(node) {
  let el = node?.nodeType === 1 ? node : node?.parentElement;
  if (!el) return false;
  if (el.closest('#sentientcy-host, [data-sentientcy]')) return true;
  for (let p = el; p; p = p.parentElement || p.getRootNode?.().host) {
    if (p.matches?.('#sentientcy-host, [data-sentientcy]') || hasCredentialHint(p)) return true;
  }
  const form = el.closest('form');
  return !!form && [...form.querySelectorAll('input, textarea, [contenteditable], [role="textbox"]')].some(hasCredentialHint);
}

export function containsSensitiveContent(el) {
  return isSensitiveElement(el) || [...(el?.querySelectorAll?.('input, textarea, [contenteditable], [data-private], [data-sentiency-private]') || [])].some(isSensitiveElement);
}

export function selectionIsSensitive(selection = window.getSelection()) {
  if (isSensitiveElement(document.activeElement)) return true;
  if (!selection?.rangeCount) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (isSensitiveElement(range.startContainer) || isSensitiveElement(range.endContainer)) return true;
    const root = range.commonAncestorContainer;
    for (const el of root.querySelectorAll?.('input, textarea, [contenteditable], [data-private], [data-sentiency-private]') || []) {
      if (isSensitiveElement(el) && range.intersectsNode(el)) return true;
    }
  }
  return false;
}

/** No model prose, image, source text, decoded text, or quoted spans cross durable/log boundaries. */
export function threatMetadata(threat = {}) {
  return {
    id: typeof threat.id === 'string' && /^[\w-]{1,100}$/.test(threat.id) ? threat.id : crypto.randomUUID(),
    timestamp: Number.isFinite(threat.timestamp) ? threat.timestamp : Date.now(),
    source: ['DOM', 'CLIPBOARD', 'SESSION', 'COPY', 'SCAN', 'IMAGE'].includes(threat.source) ? threat.source : 'SCAN',
    severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(threat.severity) ? threat.severity : 'LOW',
    confidence: Number.isFinite(threat.confidence) ? Math.min(1, Math.max(0, threat.confidence)) : 0,
    attackClass: TAXONOMY_CLASS_NAMES.includes(threat.attackClass) ? threat.attackClass : null,
    taxonomyPath: [],
    injectionSpans: [],
    originalText: '',
    geminiPartial: !!threat.geminiPartial,
    metadataOnly: true,
  };
}
