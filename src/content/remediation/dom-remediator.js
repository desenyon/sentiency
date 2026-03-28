import { REMEDIATION_MODES } from '../../shared/constants';
import { storage } from '../../shared/storage';
import { resolveRemovalSpans } from '../../shared/removal-spans';

const DOM_STYLE_ID = 'sentientcy-dom-highlight-styles';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectDomHighlightStyles(doc) {
  if (!doc || doc.getElementById(DOM_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = DOM_STYLE_ID;
  el.textContent = `
    mark[data-sentientcy-injection="1"] {
      background: linear-gradient(120deg, rgba(239,68,68,0.35), rgba(220,38,38,0.45)) !important;
      color: inherit !important;
      border-radius: 4px;
      padding: 0 2px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      animation: sentientcy-dom-pulse 1.2s ease-in-out infinite;
    }
    @keyframes sentientcy-dom-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
      50% { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
    }
    img[data-sentientcy-injection="img"],
    [data-sentientcy-injection-container="1"] {
      outline: 3px solid #ef4444 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 4px rgba(239,68,68,0.2);
      animation: sentientcy-img-pulse 1.5s ease-in-out infinite;
    }
    @keyframes sentientcy-img-pulse {
      0%, 100% { outline-color: #ef4444; }
      50% { outline-color: #f87171; }
    }
  `;
  (doc.head || doc.documentElement).appendChild(el);
}

function elementHasHeavyMediaChildren(el) {
  return !!(el?.querySelector?.('img, picture, video, iframe'));
}

function indexTextNodesUnder(root) {
  const list = [];
  let pos = 0;
  const doc = root.ownerDocument || document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('mark[data-sentientcy-injection="1"]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let cur;
  while ((cur = walker.nextNode())) {
    const t = cur.nodeValue || '';
    list.push({ node: cur, g0: pos, g1: pos + t.length });
    pos += t.length;
  }
  return { list, total: pos };
}

function effectiveHighlightSpans(raw, spans) {
  if (spans && spans.length) return spans;
  if (raw && raw.length) return [{ start: 0, end: raw.length, text: raw }];
  return [];
}

/**
 * When inline media splits the DOM into several text nodes, `element.textContent` still matches
 * the concatenation of those nodes. If there is exactly one text node (e.g. text then `<img>`),
 * replace that node with highlighted markup without touching sibling elements.
 */
function highlightMixedContentText(element, raw, spans) {
  const hl = effectiveHighlightSpans(raw, spans);
  if (!hl.length || !raw) return false;
  const { list, total } = indexTextNodesUnder(element);
  if (total !== raw.length || list.length !== 1) return false;
  const html = buildHighlightHtml(raw, hl);
  const doc = element.ownerDocument || document;
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  const parent = list[0].node.parentNode;
  if (!parent) return false;
  const frag = doc.createDocumentFragment();
  while (tpl.content.firstChild) frag.appendChild(tpl.content.firstChild);
  parent.replaceChild(frag, list[0].node);
  return true;
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
    html += `<mark data-sentientcy-injection="1">${escapeHtml(original.slice(s, e))}</mark>`;
    i = e;
  });
  html += escapeHtml(original.slice(i));
  return html;
}

/**
 * Page-level remediation always highlights injections (never strips text in-place).
 * Clipboard / field modes still honor SURGICAL separately.
 */
export async function remediateDOM(element, threat) {
  const doc = element?.ownerDocument || document;
  injectDomHighlightStyles(doc);

  const mode = (await storage.getRemediationMode()) || REMEDIATION_MODES.HIGHLIGHT;
  const tag = (element.tagName || '').toUpperCase();
  const raw = threat.originalText || element.textContent || '';
  const spans = resolveRemovalSpans(raw, threat);

  if (mode === REMEDIATION_MODES.BLOCK) {
    if (tag === 'IMG') {
      element.setAttribute(
        'alt',
        `[Content blocked by Sentiency: ${threat.attackClass || 'Threat'} detected]`,
      );
      element.setAttribute('title', 'Blocked by Sentiency');
      element.setAttribute('data-sentientcy-injection', 'img');
    } else {
      element.textContent = `[Content blocked by Sentiency: ${threat.attackClass || 'Threat'} detected]`;
      element.setAttribute('style', 'color:#b91c1c;font-weight:600;');
    }
    element.setAttribute('data-sentientcy', 'remediated');
    return;
  }

  if (tag === 'IMG') {
    element.setAttribute('data-sentientcy-injection', 'img');
    const hint = `${threat.attackClass || 'Prompt injection'} in image metadata`;
    const prev = (element.getAttribute('title') || '').trim();
    element.setAttribute('title', prev ? `${prev} · Sentiency: ${hint}` : `Sentiency: ${hint}`);
    element.setAttribute('data-sentientcy', 'remediated');
    return;
  }

  if (elementHasHeavyMediaChildren(element)) {
    const mixedOk = highlightMixedContentText(element, raw, spans);
    if (!mixedOk) {
      element.setAttribute('data-sentientcy-injection-container', '1');
    }
    element.setAttribute('data-sentientcy', 'remediated');
    return;
  }

  const hlSpans = effectiveHighlightSpans(raw, spans);
  element.innerHTML = buildHighlightHtml(raw, hlSpans);
  element.setAttribute('data-sentientcy', 'remediated');
}
