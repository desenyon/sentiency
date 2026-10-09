import { beforeEach, afterEach, vi } from 'vitest';
beforeEach(() => {
  document.body.innerHTML = '';
  globalThis.chrome = {
    runtime: { id: 'synthetic-extension', lastError: null, sendMessage: vi.fn() },
    storage: { local: { get: vi.fn((_keys, callback) => callback({})), set: vi.fn((_data, callback) => callback()), remove: vi.fn((_key, callback) => callback()) }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  };
  globalThis.fetch = vi.fn(() => { throw new Error('Unmocked network forbidden'); });
});
afterEach(() => { vi.useRealTimers(); });
