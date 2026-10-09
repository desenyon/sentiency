// Module-private EventTarget stays in the content script's isolated world.
// Never put user text or model prose on the page's window event bus.
export const contentEvents = new EventTarget();
export function emitContentEvent(type, detail) {
  contentEvents.dispatchEvent(new CustomEvent(type, { detail }));
}
