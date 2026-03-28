import { analyzeVisibility } from '../../detectors/visibility-analyzer';
import { analyzeText } from '../../pipeline/threat-pipeline';
import { remediateDOM } from '../remediation/dom-remediator';
import { ENGINE, DOM_DEBOUNCE_MS } from '../../shared/constants';
import { storage } from '../../shared/storage';

function isSentientcyNode(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.getAttribute && node.getAttribute('data-sentientcy')) return true;
  return !!node.closest?.('[data-sentientcy]');
}

function textAncestors(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || isSentientcyNode(p)) return NodeFilter.FILTER_REJECT;
      const t = n.nodeValue || '';
      if (!t.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const map = new Map();
  let cur;
  while ((cur = walker.nextNode())) {
    const p = cur.parentElement;
    if (!p) continue;
    const prev = map.get(p) || '';
    map.set(p, prev + cur.nodeValue);
  }
  return map;
}

async function scanElement(el) {
  const engines = await storage.getEngines();
  if (!engines.dom) return;
  if (isSentientcyNode(el)) return;

  const vis = analyzeVisibility(el);
  const text = (el.textContent || '').trim();
  if (!text || text.length < 8) return;
  if (!vis.isHidden) return;

  const threat = await analyzeText(text, ENGINE.DOM);
  if (threat) await remediateDOM(el, threat);
}

export function initDOMScanner() {
  let timer = null;

  const run = async () => {
    const engines = await storage.getEngines();
    if (!engines.dom) return;
    const map = textAncestors(document.body);
    for (const [el, combined] of map) {
      if (combined.length < 12) continue;
      const vis = analyzeVisibility(el);
      if (!vis.isHidden) continue;
      const threat = await analyzeText(combined, ENGINE.DOM);
      if (threat) await remediateDOM(el, threat);
    }
  };

  const schedule = (nodes) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const engines = await storage.getEngines();
      if (!engines.dom) return;
      const seen = new Set();
      nodes.forEach((n) => {
        let el = n.nodeType === 1 ? n : n.parentElement;
        while (el && el !== document.body) {
          if (isSentientcyNode(el)) return;
          if (el.nodeType === 1 && (el.textContent || '').trim().length >= 12) {
            seen.add(el);
          }
          el = el.parentElement;
        }
      });
      for (const el of seen) {
        await scanElement(el);
      }
    }, DOM_DEBOUNCE_MS);
  };

  const obs = new MutationObserver((records) => {
    const touched = [];
    records.forEach((r) => {
      if (r.type === 'childList') {
        r.addedNodes.forEach((n) => touched.push(n));
      } else if (r.type === 'characterData' && r.target) {
        touched.push(r.target);
      }
    });
    if (touched.length) schedule(touched);
  });

  if (document.body) {
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    run();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.body, { subtree: true, childList: true, characterData: true });
      run();
    });
  }
}
