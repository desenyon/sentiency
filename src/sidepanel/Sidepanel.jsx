import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './sidepanel.css';
import { storage, STORAGE_KEYS } from '../shared/storage';
import { LogoMark } from '../shared/LogoMark';
import { REMEDIATION_MODES } from '../shared/constants';

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function SidePanelApp() {
  const [threats, setThreats] = useState([]);
  const [engines, setEngines] = useState(null);
  const [mode, setMode] = useState(REMEDIATION_MODES.SURGICAL);
  const [apiOk, setApiOk] = useState(null);

  const refresh = useCallback(async () => {
    const [t, s] = await Promise.all([storage.getThreats(), storage.getSettings()]);
    setThreats(t);
    setEngines(s.engines);
    setMode(s.remediationMode || REMEDIATION_MODES.SURGICAL);
    const key = await storage.getApiKey();
    setApiOk(!!key);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const onStorage = (changes, area) => {
      if (area !== 'local') return;
      if (
        changes[STORAGE_KEYS.THREAT_LOG] ||
        changes[STORAGE_KEYS.SETTINGS] ||
        changes[STORAGE_KEYS.REMEDIATION_MODE]
      ) {
        refresh();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [refresh]);

  const toggleEngine = async (key) => {
    const cur = engines || (await storage.getEngines());
    const next = { ...cur, [key]: !cur[key] };
    await storage.setSettings({ engines: next });
    setEngines(next);
  };

  const setRemediation = async (m) => {
    await storage.setRemediationMode(m);
    setMode(m);
  };

  const clearAll = () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_THREATS' }, () => {
      void chrome.runtime.lastError;
      refresh();
    });
  };

  return (
    <div className="min-h-screen bg-matte-950 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.06),_transparent_50%)]">
      <header className="border-b border-matte-800/80 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-matte-600 bg-matte-900 p-0.5">
            <LogoMark className="h-full w-full" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-matte-50">Sentiency</h1>
            <p className="text-[11px] text-matte-400">Prompt injection defense</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${apiOk ? 'bg-emerald-950 text-emerald-300 ring-1 ring-emerald-800' : 'bg-red-950 text-red-300 ring-1 ring-red-900'}`}
          >
            API {apiOk ? 'configured' : 'missing'}
          </span>
          <button
            type="button"
            className="rounded-full bg-matte-800 px-3 py-0.5 font-medium text-matte-200 hover:bg-matte-700"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Settings
          </button>
        </div>
      </header>

      <section className="border-b border-matte-800/60 px-4 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-matte-500">Engines</h2>
        <div className="mt-3 space-y-2">
          {[
            ['dom', 'DOM scanner'],
            ['clipboard', 'Clipboard interceptor'],
            ['session', 'Session monitor (LLM sites)'],
            ['copy', 'Copy guard'],
          ].map(([k, label]) => (
            <label
              key={k}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-matte-800/80 bg-matte-900/40 px-3 py-2"
            >
              <span className="text-[13px] text-matte-200">{label}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-500"
                checked={engines ? !!engines[k] : true}
                onChange={() => toggleEngine(k)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="border-b border-matte-800/60 px-4 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-matte-500">Remediation</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.values(REMEDIATION_MODES).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRemediation(m)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${
                mode === m
                  ? 'border-accent bg-teal-950/50 text-teal-100'
                  : 'border-matte-700 bg-matte-900 text-matte-300 hover:border-matte-600'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-matte-500">Recent threats</h2>
          <button
            type="button"
            className="text-[12px] font-medium text-red-300 hover:text-red-200"
            onClick={clearAll}
          >
            Clear all
          </button>
        </div>
        <div className="space-y-2">
          {threats.length === 0 ? (
            <p className="text-[13px] text-matte-500">No threats logged yet.</p>
          ) : (
            threats.slice(0, 15).map((th) => (
              <details
                key={th.id}
                className="sentientcy-threat-row group rounded-xl border border-matte-800/80 bg-matte-900/30 px-3 py-2"
              >
                <summary className="cursor-pointer list-none text-[13px] font-medium text-matte-100">
                  <span className="mr-2 text-[10px] uppercase text-matte-500">{th.severity}</span>
                  {th.attackClass || 'Threat'} — {th.source}
                </summary>
                <p className="mt-2 text-[11px] text-matte-500">{formatTime(th.timestamp)}</p>
                <p className="mt-1 text-[12px] text-matte-400">{th.technique || th.reasoning || '—'}</p>
                <p className="mt-1 text-[11px] text-matte-500">
                  {(th.taxonomyPath || []).join(' / ')}
                </p>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<SidePanelApp />);
}
