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
      setEngines(
        s.engines || { dom: true, clipboard: true, session: true, copy: true },
      );
    })();
  }, []);

  const saveKey = async () => {
    await storage.setApiKey(key.trim());
    setTestStatus('Saved API key.');
  };

  const runTest = async () => {
    setBusy(true);
    setTestStatus('');
    try {
      await testGeminiKey(key.trim());
      setTestStatus('Key works. Model: ' + GEMINI_MODEL);
    } catch (e) {
      setTestStatus('Test failed: ' + (e.message || String(e)));
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
    setTestStatus('Settings saved.');
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
    if (!window.confirm('Clear API key, threats, and session data?')) return;
    await storage.setApiKey('');
    await storage.clearThreats();
    try {
      await chrome.storage.local.clear();
    } catch {
      setTestStatus('Cleared key and threat log; storage clear failed.');
      return;
    }
    setKey('');
    setTestStatus('All local data cleared.');
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-10 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-matte-600 bg-matte-900 p-1">
          <LogoMark className="h-full w-full" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-matte-50">Sentiency</h1>
          <p className="text-sm text-matte-400">Settings and Gemini configuration</p>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-matte-800/80 bg-matte-900/30 p-6 shadow-glow">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-matte-500">Gemini API</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-matte-400">
          Key is stored only in <code className="text-matte-200">chrome.storage.local</code>. Model:{' '}
          <code className="text-matte-200">{GEMINI_MODEL}</code>
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-matte-500">
          Tip: right-click a text selection and choose <strong className="text-matte-300">Scan selection with Sentiency</strong>, or press{' '}
          <kbd className="rounded border border-matte-600 bg-matte-900 px-1.5 py-0.5 font-mono text-matte-200">⌘⇧S</kbd> /{' '}
          <kbd className="rounded border border-matte-600 bg-matte-900 px-1.5 py-0.5 font-mono text-matte-200">Ctrl+Shift+S</kbd> to scan the
          current selection. On ChatGPT and other LLM sites, pastes in the composer use <strong className="text-matte-300">beforeinput</strong>{' '}
          interception plus in-field red highlighting when remediation is set to Highlight.
        </p>
        <input
          type="password"
          className="mt-4 w-full rounded-xl border border-matte-700 bg-matte-950 px-4 py-3 text-[14px] text-matte-100 outline-none ring-accent/0 focus:border-teal-700 focus:ring-2 focus:ring-teal-900/40"
          placeholder="API key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-matte-100 px-4 py-2 text-[13px] font-semibold text-matte-950 hover:bg-white disabled:opacity-50"
            onClick={saveKey}
            disabled={busy}
          >
            Save key
          </button>
          <button
            type="button"
            className="rounded-lg border border-matte-600 bg-matte-900 px-4 py-2 text-[13px] font-medium text-matte-100 hover:bg-matte-800 disabled:opacity-50"
            onClick={runTest}
            disabled={busy || !key.trim()}
          >
            Test key
          </button>
        </div>
        {testStatus ? <p className="mt-3 text-[13px] text-matte-300">{testStatus}</p> : null}
      </section>

      <section className="mb-8 rounded-2xl border border-matte-800/80 bg-matte-900/30 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-matte-500">Remediation default</h2>
        <div className="mt-4 space-y-3">
          {Object.values(REMEDIATION_MODES).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-xl border border-matte-800/60 bg-matte-950/50 p-3">
              <input
                type="radio"
                name="mode"
                checked={mode === m}
                onChange={() => setMode(m)}
                className="mt-1 accent-teal-500"
              />
              <div>
                <p className="text-[14px] font-medium text-matte-100">{m}</p>
                <p className="text-[12px] text-matte-500">
                  {m === 'SURGICAL' &&
                    'Default: remove flagged injection spans from pasted text and insert only the safe remainder into any text field (works on all sites).'}
                  {m === 'HIGHLIGHT' && 'Insert full paste but mark risky segments in the field when possible.'}
                  {m === 'BLOCK' && 'Block the paste entirely and show why.'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-matte-800/80 bg-matte-900/30 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-matte-500">Engines</h2>
        <div className="mt-4 space-y-2">
          {[
            ['dom',             'DOM scanner (hidden content only, all sites)'],
            ['clipboard', 'Paste interceptor (any site with inputs, textareas, or rich editors)'],
            ['session', 'LLM session trajectory'],
            ['copy', 'Copy-time risk popup'],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center justify-between rounded-xl border border-matte-800/60 px-3 py-2">
              <span className="text-[13px] text-matte-200">{label}</span>
              <input
                type="checkbox"
                className="accent-teal-500"
                checked={!!engines[k]}
                onChange={() => setEngines((e) => ({ ...e, [k]: !e[k] }))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-matte-800/80 bg-matte-900/30 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-matte-500">Classifier threshold</h2>
        <p className="mt-2 text-[13px] text-matte-400">Minimum model confidence to treat a hit as confirmed (0.5–0.9).</p>
        <input
          type="range"
          min={0.5}
          max={0.9}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="mt-4 w-full accent-teal-500"
        />
        <p className="mt-2 text-[13px] text-matte-300">{threshold.toFixed(2)}</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-teal-500"
          onClick={saveAll}
        >
          Save settings
        </button>
        <button
          type="button"
          className="rounded-lg border border-matte-600 px-5 py-2.5 text-[14px] font-medium text-matte-100 hover:bg-matte-800"
          onClick={exportLog}
        >
          Export threat log (JSON)
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-900/60 px-5 py-2.5 text-[14px] font-medium text-red-300 hover:bg-red-950/40"
          onClick={wipe}
        >
          Clear all stored data
        </button>
      </div>

      <p className="mt-10 text-[12px] text-matte-500">
        Taxonomy reference:{' '}
        <a
          className="text-accent hover:underline"
          href="https://www.crowdstrike.com/en-us/blog/ai-threats-prompt-injection/"
          target="_blank"
          rel="noreferrer"
        >
          CrowdStrike prompt injection research
        </a>
      </p>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<OptionsApp />);
}
