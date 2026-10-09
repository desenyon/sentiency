import { analyzeText } from '../../pipeline/threat-pipeline';
import { ENGINE, COPY_SCAN_MIN_CHARS } from '../../shared/constants';
import { watchEngines, DEFAULT_ENGINES } from '../../shared/storage';
import { selectionIsSensitive, isSensitiveElement } from '../../shared/privacy';
import { emitContentEvent } from '../events';

export function initCopyInterceptor() {
  let engines = { ...DEFAULT_ENGINES };
  let stopped = false;
  const stopSettings = watchEngines((value) => { engines = value; });
  const onCopy = (event) => {
    if (!engines.copy || isSensitiveElement(event.composedPath?.()[0] || event.target) || selectionIsSensitive()) return;
    const text = window.getSelection()?.toString() || '';
    if (text.length < COPY_SCAN_MIN_CHARS) return;
    const target = event.target;
    emitContentEvent('sentientcy-scan-busy', { phase: 'copy' });
    void analyzeText(text, ENGINE.COPY, { isCurrent: () => !stopped && engines.copy && !isSensitiveElement(target) })
      .then((threat) => { if (threat) emitContentEvent('sentientcy-clipboard-risk', { threat, phase: 'copy' }); })
      .catch(() => emitContentEvent('sentientcy-analysis-unavailable', { phase: 'copy' }))
      .finally(() => emitContentEvent('sentientcy-scan-idle'));
  };
  document.addEventListener('copy', onCopy, true);
  return () => { stopped = true; stopSettings(); document.removeEventListener('copy', onCopy, true); };
}
