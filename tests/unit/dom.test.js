import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ analyze: vi.fn(), persist: vi.fn(), remediate: vi.fn(), settings: null }));
vi.mock('../../src/pipeline/threat-pipeline', () => ({ analyzeText: mocks.analyze, persistAndBroadcastThreat: mocks.persist }));
vi.mock('../../src/detectors/visibility-analyzer', () => ({ analyzeVisibility: () => ({ isHidden: true }) }));
vi.mock('../../src/content/remediation/dom-remediator', () => ({ remediateDOM: mocks.remediate }));
vi.mock('../../src/shared/storage', () => ({ DEFAULT_ENGINES: { dom: false }, watchEngines: (callback) => { mocks.settings = callback; return () => {}; } }));
import { initDOMScanner } from '../../src/content/engines/dom-scanner';
let stop;
beforeEach(() => {
  vi.useFakeTimers(); mocks.analyze.mockReset().mockResolvedValue(null); mocks.persist.mockReset().mockResolvedValue(); mocks.remediate.mockReset().mockResolvedValue(true);
  stop = initDOMScanner(); mocks.settings({ dom: true });
});
afterEach(() => stop());
function add(text) { const el = document.createElement('p'); el.textContent = text; document.body.append(el); return el; }
it('accumulates separate mutations across debounce and processes arrivals during an active scan', async () => {
  add('first synthetic payload'); await vi.advanceTimersByTimeAsync(100);
  add('second synthetic payload'); await vi.advanceTimersByTimeAsync(200);
  expect(mocks.analyze.mock.calls.map(([text]) => text)).toEqual(['first synthetic payload', 'second synthetic payload']);
  let release; mocks.analyze.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  add('third synthetic payload'); await vi.advanceTimersByTimeAsync(300);
  add('fourth synthetic payload'); await vi.advanceTimersByTimeAsync(100); release(null); await vi.advanceTimersByTimeAsync(300);
  expect(mocks.analyze.mock.calls.map(([text]) => text)).toContain('fourth synthetic payload');
});
it('does not remediate/log a detached or changed node after analysis', async () => {
  let release; mocks.analyze.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const el = add('original synthetic payload'); await vi.advanceTimersByTimeAsync(300);
  el.remove(); release({ id: 'stale' }); await vi.advanceTimersByTimeAsync(300);
  expect(mocks.remediate).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled();
});
it('excludes form, editable, script and private content from DOM capture', async () => {
  document.body.innerHTML = '<form><input type="password"><p>private credential fixture</p></form><textarea>private textarea fixture</textarea><script>private script fixture</script><div contenteditable="true">private editor fixture</div>';
  await vi.advanceTimersByTimeAsync(500); expect(mocks.analyze).not.toHaveBeenCalled();
});
it('teardown prevents queued work from running', async () => {
  add('pending synthetic payload'); stop(); await vi.advanceTimersByTimeAsync(500); expect(mocks.analyze).not.toHaveBeenCalled();
});
