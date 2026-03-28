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

function ImageGlyph({ className = '' }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
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
      setImageError('Choose a PNG, JPEG, GIF, or WebP file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image too large (max 4 MB).');
      return;
    }
    if (!apiOk) {
      setImageError('Configure your Gemini API key in Settings first.');
      return;
    }
    setImageBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const threat = await analyzeImage(file.type, base64, ENGINE.IMAGE, { dispatchWindowEvent: false });
      if (threat) {
        setImageNote('Threat logged — see Recent threats below.');
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
            onClick={openOptions}
          >
            Settings
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="hidden"
        onChange={onImageFileChange}
      />

      <section className="border-b border-matte-800/60 px-4 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-matte-500">Scan image</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-matte-500">
          Upload a screenshot or image. Gemini reads visible text and flags multimodal / OCR-style prompt-injection. Results are saved to the threat log below.
        </p>
        <button
          type="button"
          disabled={imageBusy}
          onClick={onPickImage}
          className="mt-3 w-full rounded-xl border border-teal-800/80 bg-teal-950/40 px-4 py-2.5 text-[13px] font-semibold text-teal-100 hover:bg-teal-900/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {imageBusy ? 'Analyzing image…' : 'Choose image to scan'}
        </button>
        {imageError ? <p className="mt-2 text-[12px] text-red-300">{imageError}</p> : null}
        {imageNote ? <p className="mt-2 text-[12px] text-amber-200/95">{imageNote}</p> : null}
        {imageLastOk === true && !imageError ? (
          <p className="mt-2 text-[12px] text-emerald-400/95">No injection detected above your confidence threshold.</p>
        ) : null}
      </section>

      <section className="border-b border-matte-800/60 px-4 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-matte-500">Engines</h2>
        <div className="mt-3 space-y-2">
          {[
            ['dom', 'DOM scanner (hidden content, all sites)'],
            ['clipboard', 'Paste interceptor (inputs & rich editors)'],
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
        <div className="mt-3 rounded-xl border border-matte-800/80 bg-matte-900/25 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <ImageGlyph className="mt-0.5 shrink-0 text-teal-500/90" />
            <div>
              <p className="text-[12px] font-medium text-matte-200">Selection scan</p>
              <p className="mt-1 text-[11px] leading-relaxed text-matte-500">
                Right-click a text selection and choose <span className="text-matte-300">Scan selection with Sentiency</span>, or press{' '}
                <kbd className="rounded border border-matte-700 bg-matte-950 px-1 font-mono text-[10px] text-matte-300">⌘⇧S</kbd> /{' '}
                <kbd className="rounded border border-matte-700 bg-matte-950 px-1 font-mono text-[10px] text-matte-300">Ctrl+Shift+S</kbd>{' '}
                (if the shortcut does nothing, open <span className="text-matte-300">chrome://extensions/shortcuts</span> and assign Sentiency — Scan selected text).
                Always on (not toggled here).
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-matte-500">
                Paste analysis is text-based. Threats tagged with multimodal / OCR / visual patterns are highlighted below; when the pipeline logs a clipboard image, a thumbnail appears on that row.
              </p>
            </div>
          </div>
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
            threats.slice(0, 15).map((th) => {
              const visual = threatHasVisualMultimodalSignals(th);
              const preview = (th.originalText || '').slice(0, 600);
              const truncated = (th.originalText || '').length > 600;
              return (
                <details
                  key={th.id}
                  className="sentientcy-threat-row group rounded-xl border border-matte-800/80 bg-matte-900/30 px-3 py-2"
                >
                  <summary className="cursor-pointer list-none text-[13px] font-medium text-matte-100">
                    <span className="mr-2 text-[10px] uppercase text-matte-500">{th.severity}</span>
                    {th.attackClass || 'Threat'} — {threatSourceLabel(th.source)}
                  </summary>
                  <p className="mt-2 text-[11px] text-matte-500">{formatTime(th.timestamp)}</p>
                  <p className="mt-1 text-[12px] text-matte-400">{th.technique || th.reasoning || '—'}</p>
                  <p className="mt-1 text-[11px] text-matte-500">{(th.taxonomyPath || []).join(' / ')}</p>
                  {th.intent ? (
                    <p className="mt-2 text-[12px] leading-snug text-matte-300">
                      <span className="text-matte-500">Intent:</span> {th.intent}
                    </p>
                  ) : null}
                  {visual ? (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-900/45 bg-amber-950/25 px-2 py-2 text-[11px] leading-snug text-amber-100/95">
                      <ImageGlyph className="mt-0.5 shrink-0 text-amber-400/90" />
                      <span>Visual / multimodal or OCR-style signal — check source images or embedded text.</span>
                    </div>
                  ) : null}
                  {th.previewImageDataUrl ? (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-matte-500">Logged image</p>
                      <img
                        src={th.previewImageDataUrl}
                        alt=""
                        className="mt-1 max-h-36 max-w-full rounded-lg border border-matte-700 object-contain"
                      />
                    </div>
                  ) : null}
                  {preview ? (
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-matte-800/60 bg-matte-950/80 p-2 font-mono text-[11px] text-matte-400">
                      {preview}
                      {truncated ? '…' : ''}
                    </pre>
                  ) : null}
                </details>
              );
            })
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
