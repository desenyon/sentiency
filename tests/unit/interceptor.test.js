import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ analyze: vi.fn(), persist: vi.fn(), settings: null }));
vi.mock('../../src/pipeline/threat-pipeline', () => ({ analyzeText: mocks.analyze, persistAndBroadcastThreat: mocks.persist }));
vi.mock('../../src/shared/storage', () => ({
  DEFAULT_ENGINES: { clipboard: false },
  watchEngines: (callback) => { mocks.settings = callback; return () => {}; },
  storage: { getRemediationMode: async () => 'SURGICAL' },
}));
import { initClipboardInterceptor } from '../../src/content/engines/clipboard-interceptor';
let stop;
beforeEach(() => {
  vi.useFakeTimers(); mocks.analyze.mockReset(); mocks.persist.mockReset();
  mocks.analyze.mockResolvedValue(null); mocks.persist.mockResolvedValue();
  document.body.innerHTML = '<textarea id="field">prefix suffix</textarea>';
  stop = initClipboardInterceptor({});
});
afterEach(() => { stop(); });
function paste(el = document.querySelector('textarea'), text = 'SYNTHETIC PASTE') {
  const read = vi.fn(() => text);
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: read } });
  el.dispatchEvent(event); return { event, read };
}
it('does not capture or cancel before settings hydrate or while disabled', () => {
  const { event, read } = paste(); expect(event.defaultPrevented).toBe(false); expect(read).not.toHaveBeenCalled();
  mocks.settings({ clipboard: false }); expect(paste().event.defaultPrevented).toBe(false);
});
it.each(['password', 'new-password', 'one-time-code', 'cc-number'])('never reads a %s clipboard payload', (type) => {
  mocks.settings({ clipboard: true }); document.body.innerHTML = `<input ${type === 'password' ? 'type="password"' : `autocomplete="${type}"`}>`;
  const { event, read } = paste(document.querySelector('input')); expect(event.defaultPrevented).toBe(false);
  expect(read).not.toHaveBeenCalled(); expect(mocks.analyze).not.toHaveBeenCalled();
});
it('cancels synchronously and deduplicates the matching beforeinput event', async () => {
  mocks.settings({ clipboard: true }); const el = document.querySelector('textarea'); el.setSelectionRange(7, 7);
  let complete; mocks.analyze.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const { event } = paste(el); expect(event.defaultPrevented).toBe(true); expect(el.value).toBe('prefix suffix');
  const before = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: 'SYNTHETIC PASTE' });
  el.dispatchEvent(before); expect(before.defaultPrevented).toBe(true); expect(mocks.analyze).toHaveBeenCalledTimes(1);
  complete(null); await vi.advanceTimersByTimeAsync(1); expect(el.value).toBe('prefix SYNTHETIC PASTEsuffix');
});
it('handles standalone beforeinput and leaves disabled beforeinput untouched', async () => {
  const el = document.querySelector('textarea'); el.setSelectionRange(0, 0);
  const event = () => new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: 'long synthetic' });
  let e = event(); el.dispatchEvent(e); expect(e.defaultPrevented).toBe(false);
  mocks.settings({ clipboard: true }); e = event(); el.dispatchEvent(e); expect(e.defaultPrevented).toBe(true);
  await vi.advanceTimersByTimeAsync(1); expect(el.value).toBe('long syntheticprefix suffix');
});
it.each(['', 'tiny'])('leaves empty/short/rich-only native pastes untouched (%s)', (text) => {
  mocks.settings({ clipboard: true }); expect(paste(undefined, text).event.defaultPrevented).toBe(false); expect(mocks.analyze).not.toHaveBeenCalled();
});
it('discards a delayed result after user editing without persisting it', async () => {
  mocks.settings({ clipboard: true }); let complete;
  mocks.analyze.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const el = document.querySelector('textarea'); paste(el); el.value = 'user revision';
  complete({ id: 'test', originalText: 'synthetic' }); await vi.advanceTimersByTimeAsync(1);
  expect(el.value).toBe('user revision'); expect(mocks.persist).not.toHaveBeenCalled();
});
it('keeps unavailable paste paused and offers an explicit unverified insertion', async () => {
  mocks.settings({ clipboard: true }); mocks.analyze.mockRejectedValue(new Error('mock failure'));
  const el = document.querySelector('textarea'); el.setSelectionRange(0, 0); paste(el);
  await vi.advanceTimersByTimeAsync(1); expect(el.value).toBe('prefix suffix');
  expect(document.body.textContent).toContain('unavailable'); document.querySelector('#sentientcy-float-warn button').click();
  expect(el.value).toContain('SYNTHETIC PASTE');
});
it('settings disable invalidates a pending result without silently inserting it', async () => {
  mocks.settings({ clipboard: true }); let complete;
  mocks.analyze.mockImplementation(() => new Promise((resolve) => { complete = resolve; })); paste();
  mocks.settings({ clipboard: false }); complete(null); await vi.advanceTimersByTimeAsync(1);
  expect(document.querySelector('textarea').value).toBe('prefix suffix');
});

it('preserves native file/image paste even when a plain-text representation exists', () => {
  mocks.settings({ clipboard: true });
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const read = vi.fn(() => 'synthetic image caption');
  Object.defineProperty(event, 'clipboardData', { value: { items: [{ kind: 'file' }], getData: read } });
  document.querySelector('textarea').dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false); expect(read).not.toHaveBeenCalled();
});
