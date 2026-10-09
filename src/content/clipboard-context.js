const TTL_MS = 15 * 60 * 1000;

let last = null;
let expiry;

export function setLastPasteContext(inputRoot, pastedText, threat, transaction) {
  clearTimeout(expiry);
  expiry = setTimeout(() => { last = null; }, TTL_MS);
  last = {
    inputRoot,
    pastedText,
    threat,
    transaction,
    at: Date.now(),
  };
}

export function getLastPasteContext() {
  if (!last) return null;
  if (Date.now() - last.at > TTL_MS || !last.transaction?.isCurrent()) {
    last = null;
    return null;
  }
  if (!last.inputRoot || typeof last.inputRoot.isConnected !== 'boolean' || !last.inputRoot.isConnected) {
    last = null;
    return null;
  }
  return last;
}

export function clearLastPasteContext() {
  clearTimeout(expiry);
  last = null;
}
