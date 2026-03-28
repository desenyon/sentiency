import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './options.css';
import { storage } from '../shared/storage';
import { LogoMark } from '../shared/LogoMark';
import { REMEDIATION_MODES, GEMINI_API_URL, GEMINI_MODEL } from '../shared/constants';

async function testGeminiKey(key) {
  const url = `${GEMINI_API_URL}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with exactly the word OK and nothing else.' }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || res.statusText);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty model response');
  return text;
}

function OptionsApp() {
  const [key, setKey] = useState('');
  const [mode, setMode] = useState(REMEDIATION_MODES.SURGICAL);
  const [threshold, setThreshold] = useState(0.65);
  const [engines, setEngines] = useState({ dom: true, clipboard: true, session: true, copy: true });
  const [testStatus, setTestStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const k = await storage.getApiKey();
      const s = await storage.getSettings();
      setKey(k || '');
      setMode(s.remediationMode || REMEDIATION_MODES.SURGICAL);
      setThreshold(typeof s.confidenceThreshold === 'number' ? s.confidenceThreshold : 0.65);
      setEngines(s.engines || { dom: true, clipboard: true, session: true, copy: true });
    })();
  }, []);

  const saveKey = async () => {
    await storage.setApiKey(key.trim());
    setTestStatus('API key saved.');
  };

  const runTest = async () => {
    setBusy(true);
    setTestStatus('');
    try {
      await testGeminiKey(key.trim());
      setTestStatus(`Connected · ${GEMINI_MODEL}`);
    } catch (e) {
      setTestStatus(`Failed: ${e.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    await storage.setSettings({
      remediationMode: mode,
      confidenceThreshold: threshold,
      engines,
    });
    setTestStatus('Saved.');
  };

  const exportLog = async () => {
    const t = await storage.getThreats();
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentiency-threat-log.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const wipe = async () => {
    if (!window.confirm('Clear API key, threats, and all local extension data?')) return;
    await storage.setApiKey('');
    await storage.clearThreats();
    try {
      await chrome.storage.local.clear();
    } catch {
      setTestStatus('Partial clear only.');
      return;
    }
    setKey('');
    setTestStatus('Cleared.');
  };

  const engineRows = [
    { k: 'dom', title: 'DOM scanner', sub: 'Hidden text on any site' },
    { k: 'clipboard', title: 'Paste interceptor', sub: 'Inputs and editors' },
    { k: 'session', title: 'Session monitor', sub: 'LLM chat pages' },
    { k: 'copy', title: 'Copy guard', sub: 'On copy selection' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 text-zinc-100">
      <header className="border-b border-zinc-800/90 px-6 py-8">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <LogoMark className="h-8 w-8 shrink-0 opacity-95" />
            <div>
              <h1 className="text-[17px] font-semibold tracking-tight text-white">Settings</h1>
              <p className="mt-0.5 text-[12px] text-zinc-500">Sentiency</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={exportLog}
              className="opt-focus text-[12px] font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              Export log
            </button>
            <button
              type="button"
              onClick={saveAll}
              className="opt-focus text-[12px] font-semibold text-white underline decoration-zinc-600 underline-offset-4 transition hover:decoration-zinc-400"
            >
              Save
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6">
        <section className="border-b border-zinc-800/80 py-10">
          <p className="opt-label">Gemini</p>
          <p className="mt-4 text-[13px] leading-relaxed text-zinc-400">
            Key stays in <span className="text-zinc-300">chrome.storage.local</span> only. Model{' '}
            <span className="font-mono text-[12px] text-zinc-300">{GEMINI_MODEL}</span>
          </p>
          <input
            type="password"
            className="opt-input mt-6"
            placeholder="API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <button
              type="button"
              className="opt-focus text-[13px] font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500 disabled:opacity-40"
              onClick={saveKey}
              disabled={busy}
            >
              Save key
            </button>
            <button
              type="button"
              className="opt-focus text-[13px] font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500 disabled:opacity-40"
              onClick={runTest}
              disabled={busy || !key.trim()}
            >
              Test
            </button>
          </div>
          {testStatus ? <p className="mt-4 text-[12px] text-zinc-500">{testStatus}</p> : null}
        </section>

        <section className="border-b border-zinc-800/80 py-10">
          <p className="opt-label">On threat</p>
          <p className="mt-4 text-[13px] text-zinc-400">Default remediation.</p>
          <div className="mt-6 flex flex-col border-t border-zinc-800/80">
            {Object.values(REMEDIATION_MODES).map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-start gap-3 border-b border-zinc-800/60 py-3.5"
              >
                <input
                  type="radio"
                  name="mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="mt-1 border-zinc-600 bg-zinc-900 text-white"
                />
                <span>
                  <span className="block text-[13px] font-medium text-zinc-200">{m}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-zinc-500">
                    {m === 'SURGICAL' && 'Remove flagged spans; keep safe text.'}
                    {m === 'HIGHLIGHT' && 'Insert all; mark risky segments when possible.'}
                    {m === 'BLOCK' && 'Stop the paste with an explanation.'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="border-b border-zinc-800/80 py-10">
          <p className="opt-label">Protection</p>
          <p className="mt-4 text-[13px] text-zinc-400">Engines that run in the page.</p>
          <ul className="mt-6 border-t border-zinc-800/80">
            {engineRows.map(({ k, title, sub }) => (
              <li key={k}>
                <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-zinc-800/60 py-3.5">
                  <span>
                    <span className="block text-[13px] font-medium text-zinc-200">{title}</span>
                    <span className="mt-0.5 block text-[12px] text-zinc-500">{sub}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 accent-white"
                    checked={!!engines[k]}
                    onChange={() => setEngines((e) => ({ ...e, [k]: !e[k] }))}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-zinc-800/80 py-10">
          <p className="opt-label">Sensitivity</p>
          <p className="mt-4 text-[13px] text-zinc-400">Minimum confidence to confirm a hit (0.50–0.90).</p>
          <div className="mt-8 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Strict</span>
            <span className="font-mono text-[15px] font-semibold tabular-nums text-zinc-200">{threshold.toFixed(2)}</span>
            <span>Relaxed</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.9}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="opt-range mt-4"
          />
        </section>

        <section className="py-10">
          <p className="opt-label text-red-400/80">Data</p>
          <p className="mt-4 text-[13px] text-zinc-400">Remove key, log, and session data from this browser.</p>
          <button
            type="button"
            className="opt-focus mt-6 text-[13px] font-medium text-red-400/90 underline decoration-red-900/80 underline-offset-4 transition hover:text-red-300"
            onClick={wipe}
          >
            Clear everything
          </button>
        </section>

        <p className="pb-12 text-center text-[11px] text-zinc-600">
          <a
            className="opt-focus text-zinc-500 underline-offset-2 transition hover:text-zinc-400 hover:underline"
            href="https://www.crowdstrike.com/en-us/blog/ai-threats-prompt-injection/"
            target="_blank"
            rel="noreferrer"
          >
            CrowdStrike — prompt injection
          </a>
        </p>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-zinc-800/90 bg-zinc-950/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <p className="text-[11px] text-zinc-600">Unsaved changes need Save.</p>
          <button
            type="button"
            onClick={saveAll}
            className="opt-focus text-[12px] font-semibold text-white underline decoration-zinc-500 underline-offset-4 transition hover:decoration-zinc-300"
          >
            Save settings
          </button>
        </div>
      </footer>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<OptionsApp />);
}
