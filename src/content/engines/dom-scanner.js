import { analyzeVisibility } from '../../detectors/visibility-analyzer';
import { analyzeText, persistAndBroadcastThreat } from '../../pipeline/threat-pipeline';
import { remediateDOM } from '../remediation/dom-remediator';
import { ENGINE, DOM_DEBOUNCE_MS } from '../../shared/constants';
import { watchEngines, DEFAULT_ENGINES } from '../../shared/storage';
import { containsSensitiveContent } from '../../shared/privacy';

function eligible(el) {
  return el?.isConnected && !el.closest('script, style, noscript, template, input, textarea, select, [contenteditable], #sentientcy-host, [data-sentientcy]') && !containsSensitiveContent(el);
}
function payload(el) {
  if (el.tagName === 'IMG') return el.getAttribute('alt') || el.getAttribute('title') || '';
  return el.textContent || '';
}

export function initDOMScanner() {
  let engines = { ...DEFAULT_ENGINES };
  let stopped = false;
  let running = false;
  let timer;
  const pending = new Set();
  const scanned = new WeakMap();
  function collect(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    if (!el || el.closest('#sentientcy-host, [data-sentientcy]')) return;
    if (eligible(el) && el.tagName === 'IMG') pending.add(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      if (eligible(text.parentElement) && text.nodeValue.trim().length >= 8) pending.add(text.parentElement);
    }
    el.querySelectorAll('img').forEach((img) => { if (eligible(img)) pending.add(img); });
    schedule();
  }
  function schedule() {
    if (stopped || running || timer) return;
    timer = setTimeout(() => { timer = null; void drain(); }, DOM_DEBOUNCE_MS);
  }
  async function drain() {
    if (running || stopped) return;
    running = true;
    try {
      while (pending.size && !stopped) {
        const el = pending.values().next().value;
        pending.delete(el);
        if (!engines.dom || !eligible(el) || !analyzeVisibility(el).isHidden) continue;
        const text = payload(el);
        if (text.trim().length < 8 || scanned.get(el) === text) continue;
        scanned.set(el, text);
        const isCurrent = () => !stopped && engines.dom && eligible(el) && payload(el) === text && analyzeVisibility(el).isHidden;
        try {
          const threat = await analyzeText(text, ENGINE.DOM, { skipPersist: true, isCurrent });
          if (!threat || !isCurrent()) continue;
          const applied = await remediateDOM(el, threat, isCurrent);
          if (applied) await persistAndBroadcastThreat(threat, true);
        } catch { /* unavailable is not a clean verdict; retry after a content/settings change */ }
      }
    } finally { running = false; if (pending.size) schedule(); }
  }
  const stopSettings = watchEngines((value) => {
    const enabled = !engines.dom && value.dom;
    engines = value;
    if (enabled && document.body) collect(document.body);
  });
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(collect);
        if (record.removedNodes.length) collect(record.target);
      } else collect(record.target);
    }
  });
  const start = () => {
    if (stopped || !document.body) return;
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'alt', 'title', 'type', 'autocomplete'] });
    collect(document.body);
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  return () => {
    stopped = true; observer.disconnect(); stopSettings(); clearTimeout(timer); pending.clear();
    document.removeEventListener('DOMContentLoaded', start);
  };
}
