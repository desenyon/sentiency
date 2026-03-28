import './ui/panel.css';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { detectPlatform } from '../platform/platform-detector';
import { initShadowHost } from './ui/shadow-host';
import { ThreatPanel } from './ui/components/ThreatPanel';
import { RiskModal } from './ui/components/RiskModal';
import { SessionHealthBar } from './ui/components/SessionHealthBar';
import { ScanningStrip } from './ui/components/ScanningStrip';
import { initDOMScanner } from './engines/dom-scanner';
import { initClipboardInterceptor } from './engines/clipboard-interceptor';
import { initCopyInterceptor } from './engines/copy-interceptor';
import { initSessionMonitor } from './engines/session-monitor';
import { analyzeText } from '../pipeline/threat-pipeline';
import { ENGINE } from '../shared/constants';
import { STORAGE_KEYS } from '../shared/storage';

const DOM_PANEL_DEBOUNCE_MS = 600;

function App({ platformInfo }) {
  const [threat, setThreat] = useState(null);
  const [risk, setRisk] = useState(null);
  const [riskPhase, setRiskPhase] = useState('paste');
  const [busyPhase, setBusyPhase] = useState(null);
  const [storageRev, setStorageRev] = useState(0);
  const domPanelTimer = useRef(null);

  useEffect(() => {
    const onStorage = (changes, area) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.THREAT_LOG] || changes[STORAGE_KEYS.SETTINGS] || changes[STORAGE_KEYS.REMEDIATION_MODE]) {
        setStorageRev((n) => n + 1);
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

  useEffect(() => {
    const onThreat = (e) => {
      const t = e.detail;
      if (t?.source === 'DOM') {
        clearTimeout(domPanelTimer.current);
        domPanelTimer.current = setTimeout(() => setThreat(t), DOM_PANEL_DEBOUNCE_MS);
        return;
      }
      setThreat(t);
    };
    const onRisk = (e) => {
      setRisk(e.detail?.threat || null);
      setRiskPhase(e.detail?.phase || 'paste');
    };
    const onBusy = (e) => setBusyPhase(e.detail?.phase || 'paste');
    const onIdle = () => setBusyPhase(null);
    window.addEventListener('sentientcy-threat-detected', onThreat);
    window.addEventListener('sentientcy-clipboard-risk', onRisk);
    window.addEventListener('sentientcy-scan-busy', onBusy);
    window.addEventListener('sentientcy-scan-idle', onIdle);
    return () => {
      clearTimeout(domPanelTimer.current);
      window.removeEventListener('sentientcy-threat-detected', onThreat);
      window.removeEventListener('sentientcy-clipboard-risk', onRisk);
      window.removeEventListener('sentientcy-scan-busy', onBusy);
      window.removeEventListener('sentientcy-scan-idle', onIdle);
    };
  }, []);

  const openSide = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, () => void chrome.runtime.lastError);
  };

  return (
    <>
      {platformInfo.isLLMPlatform ? <SessionHealthBar onOpenPanel={openSide} /> : null}
      <ScanningStrip phase={busyPhase} />
      <ThreatPanel threat={threat} storageRev={storageRev} onDismiss={() => setThreat(null)} />
      <RiskModal threat={risk} phase={riskPhase} onDismiss={() => setRisk(null)} onOpenSide={openSide} />
    </>
  );
}

(async function main() {
  document.querySelectorAll('[data-sentientcy="badge"]').forEach((n) => n.remove());

  const platformInfo = detectPlatform();
  const { mount } = await initShadowHost();
  const root = createRoot(mount);
  root.render(<App platformInfo={platformInfo} />);

  initDOMScanner();
  initClipboardInterceptor(platformInfo);
  initCopyInterceptor();
  let stopSession = null;
  if (platformInfo.isLLMPlatform) {
    stopSession = initSessionMonitor(platformInfo);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'SHOW_THREAT' && msg.threat) {
      window.dispatchEvent(new CustomEvent('sentientcy-threat-detected', { detail: msg.threat }));
    }
    if (msg?.type === 'SCAN_SELECTION' && typeof msg.text === 'string') {
      (async () => {
        window.dispatchEvent(new CustomEvent('sentientcy-scan-busy', { detail: { phase: 'scan' } }));
        try {
          const t = await analyzeText(msg.text, ENGINE.SCAN, { forceClassifier: true });
          if (t) {
            window.dispatchEvent(new CustomEvent('sentientcy-threat-detected', { detail: t }));
            window.dispatchEvent(new CustomEvent('sentientcy-clipboard-risk', { detail: { threat: t, phase: 'scan' } }));
          }
          sendResponse?.({ ok: true, threat: !!t });
        } finally {
          window.dispatchEvent(new CustomEvent('sentientcy-scan-idle'));
        }
      })();
      return true;
    }
    if (msg?.type === 'SCAN_KEYBOARD') {
      let text = '';
      try {
        text = window.getSelection()?.toString() || '';
      } catch {
        text = '';
      }
      if (text.trim().length < 4) {
        sendResponse?.({ ok: false, reason: 'empty' });
        return true;
      }
      (async () => {
        window.dispatchEvent(new CustomEvent('sentientcy-scan-busy', { detail: { phase: 'scan' } }));
        try {
          const t = await analyzeText(text, ENGINE.SCAN, { forceClassifier: true });
          if (t) {
            window.dispatchEvent(new CustomEvent('sentientcy-threat-detected', { detail: t }));
            window.dispatchEvent(new CustomEvent('sentientcy-clipboard-risk', { detail: { threat: t, phase: 'scan' } }));
          }
          sendResponse?.({ ok: true, threat: !!t });
        } finally {
          window.dispatchEvent(new CustomEvent('sentientcy-scan-idle'));
        }
      })();
      return true;
    }
    if (msg?.type === 'SENTIENTCY_PING') {
      return true;
    }
    return false;
  });

  window.addEventListener('beforeunload', () => {
    stopSession?.();
  });
})();
