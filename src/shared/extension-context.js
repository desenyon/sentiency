/**
 * MV3: after reload/update, an old content script keeps running but `chrome.*` is invalid.
 * Accessing APIs then throws "Extension context invalidated" or fails callbacks.
 */

export function isExtensionContextValid() {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime?.id);
  } catch {
    return false;
  }
}

/**
 * Best-effort messaging; no-op when the extension context is gone.
 * @param {unknown} message
 * @param {(response: unknown) => void} [responseCallback]
 */
export function safeRuntimeSendMessage(message, responseCallback) {
  if (!isExtensionContextValid()) return;
  try {
    chrome.runtime.sendMessage(message, (...args) => {
      void chrome?.runtime?.lastError;
      responseCallback?.(...args);
    });
  } catch {
    /* Extension context invalidated */
  }
}
