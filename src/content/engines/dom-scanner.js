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

async function scanImage(img) {
  const engines = await storage.getEngines();
  if (!engines.dom) return;
  if (isSentientcyNode(img)) return;

  const vis = analyzeVisibility(img);
  if (!vis.isHidden) return;

  const alt = (img.getAttribute('alt') || '').trim();
  const title = (img.getAttribute('title') || '').trim();
  const payload = alt.length >= 8 ? alt : title.length >= 8 ? title : '';
  if (!payload) return;

  const threat = await analyzeText(payload, ENGINE.DOM);
  if (!threat) return;
  const enriched = { ...threat, originalText: threat.originalText || payload };
  await remediateDOM(img, enriched);
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
    const imgs = document.body?.querySelectorAll?.('img') || [];
    for (const img of imgs) {
      await scanImage(img);
    }
  };

  const schedule = (nodes) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const engines = await storage.getEngines();
      if (!engines.dom) return;
      const seen = new Set();
      const seenImgs = new Set();

      const collectImgs = (root) => {
        if (!root) return;
        if (root.nodeType === 1) {
          if (root.tagName === 'IMG') seenImgs.add(root);
          root.querySelectorAll?.('img').forEach((img) => seenImgs.add(img));
        } else if (root.nodeType === 11) {
          root.childNodes.forEach((ch) => collectImgs(ch));
        }
      };

      nodes.forEach((n) => {
        collectImgs(n.nodeType === 1 || n.nodeType === 11 ? n : null);
        if (n.nodeType === 1 && n.tagName === 'IMG') seenImgs.add(n);

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
      for (const img of seenImgs) {
        await scanImage(img);
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
