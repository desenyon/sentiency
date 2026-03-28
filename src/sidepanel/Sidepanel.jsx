import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './sidepanel.css';
import { storage, STORAGE_KEYS } from '../shared/storage';
import { LogoMark } from '../shared/LogoMark';
import { REMEDIATION_MODES, ENGINE } from '../shared/constants';
import { analyzeImage } from '../pipeline/threat-pipeline';
import { threatSourceLabel, threatHasVisualMultimodalSignals } from '../shared/engine-labels';
import { isExtensionContextValid, safeRuntimeSendMessage } from '../shared/extension-context';

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}

function IconImage({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function sevAccentClass(sev) {
  switch (sev) {
    case 'CRITICAL':
      return 'text-red-400';
    case 'HIGH':
      return 'text-orange-400';
    case 'MEDIUM':
      return 'text-amber-400';
    default:
      return 'text-zinc-500';
  }
}

function SidePanelApp() {
  const [threats, setThreats] = useState([]);
  const [engines, setEngines] = useState(null);
  const [mode, setMode] = useState(REMEDIATION_MODES.SURGICAL);
  const [apiOk, setApiOk] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageLastOk, setImageLastOk] = useState(null);
  const [imageNote, setImageNote] = useState('');
  const fileInputRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!isExtensionContextValid()) return;
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
      if (!isExtensionContextValid()) return;
      if (area !== 'local') return;
      if (
        changes[STORAGE_KEYS.THREAT_LOG] ||
        changes[STORAGE_KEYS.SETTINGS] ||
        changes[STORAGE_KEYS.REMEDIATION_MODE] ||
        changes[STORAGE_KEYS.ENGINES]
      ) {
        refresh();
      }
    };
    try {
      chrome.storage.onChanged.addListener(onStorage);
    } catch {
      /* invalid context */
    }
    return () => {
      try {
        chrome.storage.onChanged.removeListener(onStorage);
      } catch {
        /* invalid context */
      }
    };
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
    safeRuntimeSendMessage({ type: 'CLEAR_THREATS' }, () => {
      void refresh();
    });
  };

  const openOptions = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch {
      /* invalid context */
    }
  };

  const onPickImage = () => {
    setImageError('');
    setImageLastOk(null);
    setImageNote('');
    fileInputRef.current?.click();
  };

  const onImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setImageError('');
    setImageLastOk(null);
    setImageNote('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Use PNG, JPEG, GIF, or WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Max file size 4 MB.');
      return;
    }
    if (!apiOk) {
      setImageError('Add your API key in Settings first.');
      return;
    }
    setImageBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const threat = await analyzeImage(file.type, base64, ENGINE.IMAGE, { dispatchWindowEvent: false });
      if (threat) {
        setImageNote('Logged below.');
        setImageLastOk(null);
      } else {
        setImageLastOk(true);
      }
      await refresh();
    } catch (err) {
      setImageError(err?.message || String(err));
      setImageLastOk(null);
    } finally {
      setImageBusy(false);
    }
  };

  const engineRows = [
    { group: 'Browsing', key: 'dom', title: 'Hidden DOM text', sub: 'Off-screen or hidden copy' },
    { group: 'Input', key: 'clipboard', title: 'Paste analysis', sub: 'Fields and editors' },
    { group: 'Input', key: 'copy', title: 'Copy analysis', sub: 'When you copy' },
    { group: 'LLM sites', key: 'session', title: 'Session monitor', sub: 'Chat UIs' },
  ];

  let prevGroup = '';
  const engineList = engineRows.map((row) => {
    const showGroup = row.group !== prevGroup;
    prevGroup = row.group;
    return { ...row, showGroup };
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/90 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="h-7 w-7 shrink-0 opacity-95" />
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold tracking-tight text-white">Sentiency</h1>
              <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">Prompt injection defense</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openOptions}
            className="sp-focus-ring shrink-0 pt-0.5 text-[12px] font-medium text-zinc-400 transition hover:text-white"
          >
            Settings
          </button>
        </div>
        <div className="mt-4">
          {apiOk ? (
            <span className="sp-api-status sp-api-status--ok">
              <span className="sp-api-status-dot" aria-hidden />
              Gemini connected
            </span>
          ) : (
            <span className="sp-api-status sp-api-status--warn">
              <span className="sp-api-status-dot" aria-hidden />
              Add API key in Settings
            </span>
          )}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="hidden"
        onChange={onImageFileChange}
      />

      <main className="px-5 pb-16 pt-2">
        {/* Scan: one group, no inner boxes */}
        <section className="pt-6">
          <p className="sp-label">Scan</p>
          <p className="mt-3 max-w-[280px] text-[12px] leading-snug text-zinc-500">
            <span className="font-medium text-cyan-400/90">Gemini</span> vision on an image. Over-threshold
            threats appear in <span className="text-zinc-400">Activity</span>.
          </p>
          <button
            type="button"
            disabled={imageBusy}
            onClick={onPickImage}
            className="sp-focus-ring sp-btn-secondary mt-4 inline-flex items-center gap-2"
          >
            <IconImage className="h-3.5 w-3.5 opacity-80" />
            {imageBusy ? 'Analyzing…' : 'Choose image'}
          </button>
          {imageError ? <p className="mt-3 text-[12px] text-red-400/90">{imageError}</p> : null}
          {imageNote ? <p className="mt-3 text-[12px] text-zinc-400">{imageNote}</p> : null}
          {imageLastOk === true && !imageError ? (
            <p className="mt-3 text-[12px] text-zinc-500">No hit above threshold.</p>
          ) : null}

          <div className="mt-7 border-t border-zinc-800/80 pt-7">
            <p className="sp-label">Selection</p>
            <p className="mt-3 text-[12px] leading-snug text-zinc-500">
              Right-click your selection, then choose{' '}
              <span className="font-medium text-zinc-300">Scan with Sentiency</span>.
            </p>
            <div className="sp-selection-shortcuts">
              <span className="sp-selection-shortcuts__label">Keyboard</span>
              <div className="sp-selection-shortcuts__keys">
                <kbd className="sp-kbd-key">⌘⇧S</kbd>
                <span className="select-none text-zinc-600" aria-hidden>
                  ·
                </span>
                <kbd className="sp-kbd-key">Ctrl+Shift+S</kbd>
              </div>
              <p className="sp-selection-shortcuts__hint">
                To change shortcuts, open{' '}
                <code>chrome://extensions/shortcuts</code>
              </p>
            </div>
          </div>
        </section>

        <div className="my-8 h-px w-full shrink-0 bg-zinc-800/80" aria-hidden />

        {/* Protection: flat rows */}
        <section>
          <p className="sp-label">Protection</p>
          <p className="mt-3 max-w-[300px] text-[12px] leading-snug text-zinc-500">
            Auto on pages; selection scan uses the context menu.
          </p>
          <ul className="mt-5 list-none border-t border-zinc-800/70 p-0 divide-y divide-zinc-800/50">
            {engineList.map(({ group, showGroup, key, title, sub }) => (
              <li key={key}>
                {showGroup ? (
                  <p className={`sp-label mb-1.5 ${group === 'Browsing' ? 'pt-2' : 'pt-6'}`}>{group}</p>
                ) : null}
                <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5 transition hover:bg-zinc-900/20">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-zinc-200">{title}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-zinc-500">{sub}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-white accent-white"
                    checked={engines ? !!engines[key] : true}
                    onChange={() => toggleEngine(key)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>

        <div className="my-8 h-px w-full shrink-0 bg-zinc-800/80" aria-hidden />

        <section>
          <p className="sp-label">On threat</p>
          <p className="mt-2.5 text-[12px] leading-snug text-zinc-500">
            Default for paste flows (mirrors Settings).
          </p>
          <div
            className="sp-segmented"
            role="radiogroup"
            aria-label="Remediation when threat detected"
          >
            {Object.values(REMEDIATION_MODES).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setRemediation(m)}
                className={`sp-focus-ring sp-segmented__btn ${mode === m ? 'is-active' : ''}`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-snug text-zinc-600">
            Surgical strips spans · Highlight marks · Block stops paste
          </p>
        </section>

        <div className="my-8 h-px w-full shrink-0 bg-zinc-800/80" aria-hidden />

        {/* Activity */}
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <p className="sp-label">Activity</p>
            {threats.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="sp-focus-ring text-[11px] font-medium text-zinc-500 transition hover:text-zinc-300"
              >
                Clear all
              </button>
            ) : null}
          </div>

          {threats.length === 0 ? (
            <p className="mt-6 text-[12px] text-zinc-500">No activity yet.</p>
          ) : (
            <ul className="mt-6 border-t border-zinc-800/80">
              {threats.slice(0, 15).map((th) => {
                const visual = threatHasVisualMultimodalSignals(th);
                const preview = (th.originalText || '').slice(0, 600);
                const truncated = (th.originalText || '').length > 600;
                return (
                  <li key={th.id} className="border-b border-zinc-800/60">
                    <details className="sp-threat-details group">
                      <summary className="flex cursor-pointer list-none items-start gap-2 py-3.5 pr-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className={`text-[11px] font-semibold uppercase tracking-wide ${sevAccentClass(th.severity)}`}>
                              {th.severity}
                            </span>
                            <span className="text-[13px] font-medium text-zinc-200">{th.attackClass || 'Threat'}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {threatSourceLabel(th.source)} · {formatTime(th.timestamp)}
                          </p>
                        </div>
                        <svg
                          className="sp-chevron mt-0.5 h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </summary>
                      <div className="space-y-3 pb-4 pl-0.5 pt-0">
                        <p className="text-[12px] leading-relaxed text-zinc-400">{th.technique || th.reasoning || '—'}</p>
                        <p className="text-[11px] text-zinc-600">{(th.taxonomyPath || []).join(' → ') || '—'}</p>
                        {th.intent ? (
                          <p className="text-[12px] text-zinc-400">
                            <span className="text-zinc-600">Intent</span> {th.intent}
                          </p>
                        ) : null}
                        {visual ? (
                          <p className="flex items-start gap-2 text-[11px] leading-snug text-zinc-500">
                            <IconImage className="mt-0.5 shrink-0 text-zinc-600" />
                            <span>Visual signal — check source image.</span>
                          </p>
                        ) : null}
                        {th.previewImageDataUrl ? (
                          <div>
                            <p className="sp-label">Image</p>
                            <img
                              src={th.previewImageDataUrl}
                              alt=""
                              className="mt-2 max-h-36 max-w-full border border-zinc-800 object-contain"
                            />
                          </div>
                        ) : null}
                        {preview ? (
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono text-[10px] leading-relaxed text-zinc-500">
                            {preview}
                            {truncated ? '…' : ''}
                          </pre>
                        ) : null}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<SidePanelApp />);
}
