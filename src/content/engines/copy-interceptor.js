import { analyzeText } from '../../pipeline/threat-pipeline';
import { ENGINE, COPY_SCAN_MIN_CHARS } from '../../shared/constants';
import { storage } from '../../shared/storage';

function dispatchRisk(threat, phase) {
  window.dispatchEvent(new CustomEvent('sentientcy-clipboard-risk', { detail: { threat, phase } }));
}

function scanBusy(phase) {
  window.dispatchEvent(new CustomEvent('sentientcy-scan-busy', { detail: { phase } }));
}

function scanIdle() {
  window.dispatchEvent(new CustomEvent('sentientcy-scan-idle'));
}

export function initCopyInterceptor() {
  document.addEventListener(
    'copy',
    (event) => {
      (async () => {
        const engines = await storage.getEngines();
        if (!engines.copy) return;

        let text = '';
        try {
          text = window.getSelection()?.toString() || '';
        } catch {
          text = '';
        }
        if (!text || text.length < COPY_SCAN_MIN_CHARS) return;

        scanBusy('copy');
        try {
          const threat = await analyzeText(text, ENGINE.COPY);
          if (threat) dispatchRisk(threat, 'copy');
        } finally {
          scanIdle();
        }
      })();
    },
    true,
  );
}
