import { REMEDIATION_MODES } from './remediation-modes';
import { isExtensionContextValid } from './extension-context';
import { threatMetadata } from './privacy';

export const STORAGE_KEYS = {
  API_KEY: 'geminiApiKey', REMEDIATION_MODE: 'remediationMode', THREAT_LOG: 'threatLog',
  SESSION_PREFIX: 'session_', SETTINGS: 'settings', ENGINES: 'engines',
};
const K = STORAGE_KEYS;
export const DEFAULT_ENGINES = { dom: false, clipboard: false, session: false, copy: false };
export const DEFAULT_SETTINGS = {
  remediationMode: REMEDIATION_MODES.SURGICAL, confidenceThreshold: 0.65,
  remoteAnalysisEnabled: false, engines: DEFAULT_ENGINES,
};
function mode(raw) {
  const value = String(raw || '').toUpperCase();
  return Object.values(REMEDIATION_MODES).includes(value) ? value : REMEDIATION_MODES.SURGICAL;
}
function engines(value) {
  return Object.fromEntries(Object.keys(DEFAULT_ENGINES).map((k) => [k, value?.[k] === true]));
}
export function normalizeSettings(v = {}) {
  const raw = v[K.SETTINGS] || {};
  return {
    remediationMode: mode(v[K.REMEDIATION_MODE] ?? raw.remediationMode),
    confidenceThreshold: Number.isFinite(raw.confidenceThreshold) ? Math.min(0.9, Math.max(0.5, raw.confidenceThreshold)) : 0.65,
    remoteAnalysisEnabled: raw.remoteAnalysisEnabled === true,
    engines: engines(v[K.ENGINES] ?? raw.engines),
  };
}
export function localOperation(method, arg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Extension storage timed out')), 5000);
    try {
      if (!isExtensionContextValid()) throw new Error('Extension context unavailable');
      chrome.storage.local[method](arg, (result) => {
        clearTimeout(timer);
        const error = chrome.runtime.lastError;
        if (error) reject(new Error('Extension storage operation failed'));
        else resolve(result ?? {});
      });
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}
function sessionKey(id) {
  if (!/^(?:\d+|test-[\w-]+)$/.test(String(id))) throw new Error('Invalid session id');
  return `${K.SESSION_PREFIX}${id}`;
}
function sessionMetadata(turns) {
  return (Array.isArray(turns) ? turns : []).slice(-20).map((t) => ({
    role: t.role === 'assistant' ? 'assistant' : 'user',
    timestamp: Number.isFinite(t.timestamp) ? t.timestamp : Date.now(),
  }));
}

/** Only the service worker owns this queue. Acknowledgment follows durable completion. */
export function createStorageWriter(io = localOperation) {
  let tail = Promise.resolve();
  return (operation, payload = {}) => {
    const task = tail.then(async () => {
      if (operation === 'migrate') {
        const all = await io('get', null);
        const clean = { [K.THREAT_LOG]: (Array.isArray(all[K.THREAT_LOG]) ? all[K.THREAT_LOG] : []).slice(0, 100).map(threatMetadata) };
        for (const key of Object.keys(all)) {
          if (key.startsWith(K.SESSION_PREFIX)) clean[key] = sessionMetadata(all[key]);
        }
        await io('set', clean);
      } else if (operation === 'logThreat') {
        const v = await io('get', [K.THREAT_LOG]);
        const next = threatMetadata(payload.threat);
        const old = Array.isArray(v[K.THREAT_LOG]) ? v[K.THREAT_LOG] : [];
        await io('set', { [K.THREAT_LOG]: [next, ...old.filter((t) => t.id !== next.id).map(threatMetadata)].slice(0, 100) });
      } else if (operation === 'clearThreats') {
        await io('set', { [K.THREAT_LOG]: [] });
      } else if (operation === 'setSettings') {
        const v = await io('get', [K.SETTINGS, K.REMEDIATION_MODE, K.ENGINES]);
        const current = normalizeSettings(v);
        const patch = payload.settings || {};
        const next = normalizeSettings({ settings: { ...current, ...patch, engines: { ...current.engines, ...patch.engines } } });
        await io('set', { [K.SETTINGS]: next, [K.REMEDIATION_MODE]: next.remediationMode, [K.ENGINES]: next.engines });
      } else if (operation === 'setApiKey') {
        await io('set', { [K.API_KEY]: typeof payload.key === 'string' ? payload.key.slice(0, 512) : '' });
      } else if (operation === 'appendSessionTurn' || operation === 'setSessionHistory') {
        const key = sessionKey(payload.tabId);
        const old = operation === 'appendSessionTurn' ? (await io('get', [key]))[key] || [] : [];
        await io('set', { [key]: sessionMetadata(operation === 'appendSessionTurn' ? [...old, payload.turn] : payload.turns) });
      } else if (operation === 'clearSession') {
        await io('remove', sessionKey(payload.tabId));
      } else if (operation === 'clearAll') {
        await io('clear', undefined);
      } else throw new Error('Unsupported storage operation');
      return { ok: true };
    });
    tail = task.catch(() => {});
    return task;
  };
}
let workerWriter;
export function registerStorageWriter(writer) { workerWriter = writer; }
function mutate(operation, payload = {}) {
  if (workerWriter) return workerWriter(operation, payload);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Storage worker unavailable')), 10000);
    try {
      chrome.runtime.sendMessage({ type: 'STORAGE_MUTATE', operation, payload }, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError || !response?.ok) reject(new Error('Storage write failed'));
        else resolve();
      });
    } catch { clearTimeout(timer); reject(new Error('Storage worker unavailable')); }
  });
}
export const storage = {
  getApiKey: async () => (await localOperation('get', [K.API_KEY]))[K.API_KEY] || null,
  setApiKey: (key) => mutate('setApiKey', { key }),
  getSettings: async () => normalizeSettings(await localOperation('get', [K.SETTINGS, K.REMEDIATION_MODE, K.ENGINES])),
  setSettings: (settings) => mutate('setSettings', { settings }),
  getEngines: async () => (await storage.getSettings()).engines,
  getRemediationMode: async () => (await storage.getSettings()).remediationMode,
  setRemediationMode: (remediationMode) => storage.setSettings({ remediationMode }),
  logThreat: (threat) => mutate('logThreat', { threat: threatMetadata(threat) }),
  getThreats: async () => {
    const data = (await localOperation('get', [K.THREAT_LOG]))[K.THREAT_LOG];
    return (Array.isArray(data) ? data : []).map(threatMetadata);
  },
  clearThreats: () => mutate('clearThreats'),
  sessionKey,
  getSessionHistory: async (tabId) => sessionMetadata((await localOperation('get', [sessionKey(tabId)]))[sessionKey(tabId)]),
  appendSessionTurn: (tabId, turn) => mutate('appendSessionTurn', { tabId, turn: sessionMetadata([turn])[0] }),
  setSessionHistory: (tabId, turns) => mutate('setSessionHistory', { tabId, turns: sessionMetadata(turns) }),
  clearSession: (tabId) => mutate('clearSession', { tabId }),
  clearAll: () => mutate('clearAll'),
};

/** Fail-open for native editing until settings hydrate; never capture while disabled. */
export function watchEngines(onChange) {
  let stopped = false;
  let revision = 0;
  const refresh = async () => {
    const current = ++revision;
    try {
      const value = await storage.getEngines();
      if (!stopped && current === revision) onChange(value);
    } catch { if (!stopped && current === revision) onChange({ ...DEFAULT_ENGINES }); }
  };
  const listener = (_changes, area) => { if (area === 'local') void refresh(); };
  chrome.storage.onChanged.addListener(listener);
  void refresh();
  return () => { stopped = true; chrome.storage.onChanged.removeListener(listener); };
}
