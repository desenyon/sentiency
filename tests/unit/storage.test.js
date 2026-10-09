import { it, expect, vi } from 'vitest';
import { createStorageWriter, normalizeSettings, localOperation } from '../../src/shared/storage';
function memoryIO(seed = {}) {
  const data = structuredClone(seed);
  const io = vi.fn(async (method, value) => {
    await Promise.resolve();
    if (method === 'get') return structuredClone(value ? Object.fromEntries(value.map((key) => [key, data[key]])) : data);
    if (method === 'set') Object.assign(data, structuredClone(value));
    if (method === 'remove') delete data[value];
    if (method === 'clear') Object.keys(data).forEach((key) => delete data[key]);
  });
  return { data, io };
}
it('defaults every automatic engine and remote transmission off; normalizes malformed settings', () => {
  expect(normalizeSettings().remoteAnalysisEnabled).toBe(false);
  expect(Object.values(normalizeSettings().engines)).toEqual([false, false, false, false]);
  expect(normalizeSettings({ settings: { confidenceThreshold: 99, remoteAnalysisEnabled: 'true', engines: { clipboard: 'yes' } } })).toMatchObject({ confidenceThreshold: 0.9, remoteAnalysisEnabled: false, engines: { clipboard: false } });
});
it('serializes concurrent writers without dropped records and bounds/deduplicates the log', async () => {
  const { data, io } = memoryIO(); const write = createStorageWriter(io);
  await Promise.all(Array.from({ length: 130 }, (_, i) => write('logThreat', { threat: { id: `test-${i}`, originalText: 'PRIVATE' } })));
  expect(data.threatLog).toHaveLength(100); expect(new Set(data.threatLog.map((t) => t.id)).size).toBe(100);
  expect(JSON.stringify(data)).not.toContain('PRIVATE');
  await write('logThreat', { threat: { id: 'test-129' } }); expect(data.threatLog).toHaveLength(100);
});
it('merges racing settings patches and respects ordered clear barriers', async () => {
  const { data, io } = memoryIO(); const write = createStorageWriter(io);
  await Promise.all([write('setSettings', { settings: { engines: { clipboard: true } } }), write('setSettings', { settings: { engines: { copy: true } } })]);
  expect(data.engines).toMatchObject({ clipboard: true, copy: true });
  await Promise.all([write('logThreat', { threat: { id: 'before' } }), write('clearThreats'), write('logThreat', { threat: { id: 'after' } })]);
  expect(data.threatLog.map((t) => t.id)).toEqual(['after']);
});
it('migrates legacy raw records/session turns and persists session metadata only', async () => {
  const { data, io } = memoryIO({ threatLog: [{ id: 'old', reasoning: 'PRIVATE', originalText: 'PRIVATE' }], session_7: [{ role: 'user', content: 'PRIVATE' }] });
  const write = createStorageWriter(io); await write('migrate');
  await Promise.all(Array.from({ length: 24 }, () => write('appendSessionTurn', { tabId: 7, turn: { role: 'assistant', content: 'PRIVATE' } })));
  expect(data.session_7).toHaveLength(20); expect(JSON.stringify(data)).not.toContain('PRIVATE');
});
it('rejects failed writes and continues queue processing; a new writer sees durable data', async () => {
  const { data, io } = memoryIO(); const write = createStorageWriter(io);
  io.mockRejectedValueOnce(new Error('disk full'));
  await expect(write('logThreat', { threat: { id: 'lost' } })).rejects.toThrow('disk full');
  await write('logThreat', { threat: { id: 'saved' } });
  await createStorageWriter(io)('logThreat', { threat: { id: 'restart' } });
  expect(data.threatLog.map((t) => t.id)).toEqual(['restart', 'saved']);
});
it('acknowledges only completed writes', async () => {
  let release; const io = vi.fn((method) => method === 'get' ? Promise.resolve({}) : new Promise((resolve) => { release = resolve; }));
  let acknowledged = false; const task = createStorageWriter(io)('clearThreats').then(() => { acknowledged = true; });
  await Promise.resolve(); expect(acknowledged).toBe(false); release(); await task; expect(acknowledged).toBe(true);
});
it('surfaces Chrome storage failures instead of pretending success', async () => {
  chrome.storage.local.set.mockImplementation((_data, callback) => { chrome.runtime.lastError = { message: 'failure' }; callback(); chrome.runtime.lastError = null; });
  await expect(localOperation('set', {})).rejects.toThrow('failed');
});
