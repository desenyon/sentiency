import { selectionIsSensitive } from '../shared/privacy';
import { showPasteNotice } from './remediation/clipboard-remediator';
import { contentEvents } from './events';
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
import { isExtensionContextValid, safeRuntimeSendMessage } from '../shared/extension-context';

const DOM_PANEL_DEBOUNCE_MS = 600;

/**
 * Register before any async work so context-menu / keyboard scans work immediately after load.
 */
function attachEarlyMessageBridge() {
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'SHOW_THREAT' && msg.threat) {
        contentEvents.dispatchEvent(new CustomEvent('sentientcy-threat-detected', { detail: msg.threat }));
      }
      if (msg?.type === 'SCAN_SELECTION' || msg?.type === 'SCAN_KEYBOARD') {
        if (selectionIsSensitive()) { sendResponse({ ok: false, reason: 'excluded' }); return false; }
        const text = window.getSelection()?.toString() || '';
        if (text.trim().length < 4) { sendResponse({ ok: false, reason: 'empty' }); return false; }
        contentEvents.dispatchEvent(new CustomEvent('sentientcy-scan-busy', { detail: { phase: 'scan' } }));
        void analyzeText(text, ENGINE.SCAN, { forceClassifier: true, isCurrent: () => !selectionIsSensitive() })
          .then((threat) => {
            if (threat) contentEvents.dispatchEvent(new CustomEvent('sentientcy-clipboard-risk', { detail: { threat, phase: 'scan' } }));
            else showPasteNotice(document.body, 'No threat detected in this selection. This is not a safety guarantee.');
            sendResponse({ ok: true, threat: !!threat });
          })
          .catch(() => {
            showPasteNotice(document.body, 'Selection analysis unavailable. No clean verdict was produced.');
            sendResponse({ ok: false, reason: 'unavailable' });
          })
          .finally(() => contentEvents.dispatchEvent(new CustomEvent('sentientcy-scan-idle')));
        return true;
      }
      if (msg?.type === 'SENTIENTCY_PING') {
        sendResponse?.({ ok: true });
        return true;
      }
      return false;
    });
  } catch {
    /* extension context invalidated */
  }
}

attachEarlyMessageBridge();

function App({ platformInfo }) {
  const [threat, setThreat] = useState(null);
  const [risk, setRisk] = useState(null);
  const [riskPhase, setRiskPhase] = useState('paste');
  const [busyPhase, setBusyPhase] = useState(null);
  const [storageRev, setStorageRev] = useState(0);
  const domPanelTimer = useRef(null);
  const busyCount = useRef(0);

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
        setStorageRev((n) => n + 1);
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
    const onBusy = (e) => { busyCount.current++; setBusyPhase(e.detail?.phase || 'paste'); };
    const onIdle = () => { busyCount.current = Math.max(0, busyCount.current - 1); if (!busyCount.current) setBusyPhase(null); };
    const onUnavailable = () => showPasteNotice(document.body, 'Analysis unavailable. No clean verdict was produced.');
    contentEvents.addEventListener('sentientcy-analysis-unavailable', onUnavailable);
    contentEvents.addEventListener('sentientcy-threat-detected', onThreat);
    contentEvents.addEventListener('sentientcy-clipboard-risk', onRisk);
    contentEvents.addEventListener('sentientcy-scan-busy', onBusy);
    contentEvents.addEventListener('sentientcy-scan-idle', onIdle);
    return () => {
      clearTimeout(domPanelTimer.current);
      contentEvents.removeEventListener('sentientcy-analysis-unavailable', onUnavailable);
      contentEvents.removeEventListener('sentientcy-threat-detected', onThreat);
      contentEvents.removeEventListener('sentientcy-clipboard-risk', onRisk);
      contentEvents.removeEventListener('sentientcy-scan-busy', onBusy);
      contentEvents.removeEventListener('sentientcy-scan-idle', onIdle);
    };
  }, []);

  const openSide = () => {
    safeRuntimeSendMessage({ type: 'OPEN_SIDE_PANEL' });
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

  const stopDOM = initDOMScanner();
  const stopClipboard = initClipboardInterceptor(platformInfo);
  const stopCopy = initCopyInterceptor();
  let stopSession = null;
  if (platformInfo.isLLMPlatform) {
    stopSession = initSessionMonitor(platformInfo);
  }

  window.addEventListener('beforeunload', () => {
    stopSession?.(); stopDOM(); stopClipboard(); stopCopy();
  });
})();
