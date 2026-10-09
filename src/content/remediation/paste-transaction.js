import { isEditableTarget } from '../engines/input-resolve';

const active = new WeakMap();
const TTL_MS = 15 * 60 * 1000;

/** Saved selection + revision guard. Only this transaction's insertion can be replaced. */
export function createPasteTransaction(root, onDispose = () => {}) {
  if (!isEditableTarget(root) || !root.isConnected) return null;
  active.get(root)?.dispose();
  const field = root.tagName === 'INPUT' || root.tagName === 'TEXTAREA';
  let expected = field ? root.value : root.innerHTML;
  let dirty = false;
  let applying = false;
  let disposed = false;
  let start = field ? root.selectionStart : null;
  let end = field ? root.selectionEnd : null;
  if (field && (start == null || end == null)) return null;
  let range;
  let left;
  let right;
  let originalNodes;
  const originalValue = expected;
  const originalSelection = field ? expected.slice(start, end) : null;
  if (!field) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    range = selection.getRangeAt(0).cloneRange();
    if (!root.contains(range.commonAncestorContainer)) return null;
  }
  const onInput = () => { if (!applying) dirty = true; };
  root.addEventListener('input', onInput);
  const observer = new MutationObserver(() => { if (!applying) dirty = true; });
  if (!field) observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true });
  const at = Date.now();
  const transaction = {
    root,
    isCurrent() {
      if (observer.takeRecords().length) dirty = true;
      return !disposed && !dirty && Date.now() - at < TTL_MS && active.get(root) === transaction
        && root.isConnected && isEditableTarget(root) && (field ? root.value : root.innerHTML) === expected;
    },
    replace(text) {
      if (!transaction.isCurrent()) return false;
      applying = true;
      try {
        if (field) {
          const replacement = text === null ? originalSelection : text;
          const next = expected.slice(0, start) + replacement + expected.slice(end);
          const proto = root.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(root, next);
          end = start + replacement.length;
          root.setSelectionRange(end, end);
        } else {
          if (!left) {
            originalNodes = [...range.extractContents().childNodes];
            left = document.createComment('sentiency-start');
            right = document.createComment('sentiency-end');
            range.insertNode(right);
            range.insertNode(left);
          }
          range = document.createRange();
          range.setStartAfter(left);
          range.setEndBefore(right);
          range.deleteContents();
          const fragment = document.createDocumentFragment();
          if (text === null) originalNodes.forEach((node) => fragment.appendChild(node));
          else fragment.appendChild(document.createTextNode(text));
          range.insertNode(fragment);
          range.setStartBefore(right);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        observer.takeRecords();
        expected = field ? root.value : root.innerHTML;
        root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: null }));
        // Framework handlers may synchronously rewrite the field. Do not adopt their edits.
        return (field ? root.value : root.innerHTML) === expected;
      } finally { applying = false; }
    },
    undo() { return transaction.replace(null); },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(expiry);
      observer.disconnect();
      root.removeEventListener('input', onInput);
      left?.remove(); right?.remove();
      if (active.get(root) === transaction) active.delete(root);
      onDispose();
    },
    originalValue,
  };
  const expiry = setTimeout(() => transaction.dispose(), TTL_MS);
  active.set(root, transaction);
  return transaction;
}
