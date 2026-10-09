import { storage } from '../../shared/storage';
import { REMEDIATION_MODES } from '../../shared/constants';
import { containsSensitiveContent } from '../../shared/privacy';

const remediations = new WeakMap();
export function undoDOMRemediation(element) {
  const undo = remediations.get(element);
  return undo ? undo() : false;
}

/** Preserve child nodes, event listeners, formatting, and media; never parse model text as HTML. */
export async function remediateDOM(element, threat, isCurrent = () => true) {
  const mode = await storage.getRemediationMode();
  if (!element?.isConnected || containsSensitiveContent(element) || !isCurrent()) return false;
  const previous = { style: element.getAttribute('style'), title: element.getAttribute('title'), marker: element.getAttribute('data-sentientcy') };
  element.setAttribute('data-sentientcy', 'remediated');
  element.title = `Sentiency: ${threat.attackClass || 'Potential prompt injection'}`;
  if (mode === REMEDIATION_MODES.BLOCK) element.style.setProperty('display', 'none', 'important');
  else { element.style.setProperty('outline', '3px solid #ef4444', 'important'); element.style.setProperty('outline-offset', '3px'); }
  const appliedStyle = element.getAttribute('style');
  const appliedTitle = element.title;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = mode === REMEDIATION_MODES.BLOCK ? 'Sentiency blocked content — restore' : 'Sentiency flagged content — undo';
  button.setAttribute('data-sentientcy', 'undo');
  element.after(button);
  const restore = () => {
    if (!element.isConnected || element.getAttribute('style') !== appliedStyle || element.title !== appliedTitle) return false;
    for (const [name, value] of [['style', previous.style], ['title', previous.title], ['data-sentientcy', previous.marker]]) {
      if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
    }
    button.remove(); remediations.delete(element);
    return true;
  };
  button.addEventListener('click', restore);
  remediations.set(element, restore);
  return true;
}
