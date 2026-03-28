const TTL_MS = 15 * 60 * 1000;

let last = null;

export function setLastPasteContext(inputRoot, pastedText, threat) {
  last = {
    inputRoot,
    pastedText,
    threat,
    at: Date.now(),
  };
}

export function getLastPasteContext() {
  if (!last) return null;
  if (Date.now() - last.at > TTL_MS) {
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
  last = null;
}
