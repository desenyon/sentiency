import { REMEDIATION_MODES } from './remediation-modes';

export const STORAGE_KEYS = {
  API_KEY: 'geminiApiKey',
  REMEDIATION_MODE: 'remediationMode',
  THREAT_LOG: 'threatLog',
  SESSION_PREFIX: 'session_',
  SETTINGS: 'settings',
  ENGINES: 'engines',
};

const KEYS = STORAGE_KEYS;

function normalizeRemediationMode(raw) {
  const u = String(raw == null ? '' : raw).toUpperCase();
  return Object.values(REMEDIATION_MODES).includes(u) ? u : REMEDIATION_MODES.SURGICAL;
}

const DEFAULT_SETTINGS = {
  remediationMode: REMEDIATION_MODES.SURGICAL,
  confidenceThreshold: 0.65,
  engines: {
    dom: true,
    clipboard: true,
    session: true,
    copy: true,
  },
};

async function getLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function setLocal(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}

export const storage = {
  async getApiKey() {
    const v = await getLocal([KEYS.API_KEY]);
    return v[KEYS.API_KEY] || null;
  },

  async setApiKey(key) {
    await setLocal({ [KEYS.API_KEY]: key || '' });
  },

  async getRemediationMode() {
    const v = await getLocal([KEYS.REMEDIATION_MODE]);
    return normalizeRemediationMode(v[KEYS.REMEDIATION_MODE] ?? DEFAULT_SETTINGS.remediationMode);
  },

  async setRemediationMode(mode) {
    await setLocal({ [KEYS.REMEDIATION_MODE]: normalizeRemediationMode(mode) });
  },

  async logThreat(threat) {
    const v = await getLocal([KEYS.THREAT_LOG]);
    const log = Array.isArray(v[KEYS.THREAT_LOG]) ? v[KEYS.THREAT_LOG] : [];
    log.unshift(threat);
    await setLocal({ [KEYS.THREAT_LOG]: log.slice(0, 100) });
  },

  async getThreats() {
    const v = await getLocal([KEYS.THREAT_LOG]);
    return Array.isArray(v[KEYS.THREAT_LOG]) ? v[KEYS.THREAT_LOG] : [];
  },

  async clearThreats() {
    await setLocal({ [KEYS.THREAT_LOG]: [] });
  },

  sessionKey(tabId) {
    return `${KEYS.SESSION_PREFIX}${tabId}`;
  },

  async getSessionHistory(tabId) {
    const k = this.sessionKey(tabId);
    const v = await getLocal([k]);
    const arr = v[k];
    return Array.isArray(arr) ? arr : [];
  },

  async appendSessionTurn(tabId, turn) {
    const k = this.sessionKey(tabId);
    const v = await getLocal([k]);
    const arr = Array.isArray(v[k]) ? v[k] : [];
    arr.push(turn);
    await setLocal({ [k]: arr.slice(-20) });
  },

  async setSessionHistory(tabId, turns) {
    const k = this.sessionKey(tabId);
    const clean = (turns || []).map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: t.timestamp || Date.now(),
    }));
    await setLocal({ [k]: clean.slice(-20) });
  },

  async clearSession(tabId) {
    const k = this.sessionKey(tabId);
    await chrome.storage.local.remove(k);
  },

  async getSettings() {
    const v = await getLocal([KEYS.SETTINGS, KEYS.REMEDIATION_MODE, KEYS.ENGINES]);
    const base = { ...DEFAULT_SETTINGS, ...(v[KEYS.SETTINGS] || {}) };
    base.remediationMode = normalizeRemediationMode(v[KEYS.REMEDIATION_MODE] ?? base.remediationMode);
    if (v[KEYS.ENGINES]) base.engines = { ...DEFAULT_SETTINGS.engines, ...v[KEYS.ENGINES] };
    return base;
  },

  async setSettings(settings) {
    const cur = await this.getSettings();
    const next = { ...cur, ...settings };
    next.remediationMode = normalizeRemediationMode(next.remediationMode);
    await setLocal({
      [KEYS.SETTINGS]: next,
      [KEYS.REMEDIATION_MODE]: next.remediationMode,
      [KEYS.ENGINES]: next.engines,
    });
  },

  async getEngines() {
    const s = await this.getSettings();
    return s.engines;
  },
};
