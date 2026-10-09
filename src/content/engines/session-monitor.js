import { analyzeText, analyzeTrajectory, persistAndBroadcastThreat } from '../../pipeline/threat-pipeline';
import { remediateSession } from '../remediation/session-remediator';
import { ENGINE, STREAMING_STABLE_MS } from '../../shared/constants';
import { watchEngines, DEFAULT_ENGINES, storage } from '../../shared/storage';
import { containsSensitiveContent } from '../../shared/privacy';
import { emitContentEvent } from '../events';

export function snapshotSession(selectors) {
  const out = [];
  for (const node of document.querySelectorAll(selectors.messageContainer)) {
    if (containsSensitiveContent(node)) continue;
    const matches = (selector) => selector && (node.matches(selector) || node.querySelector(selector));
    const role = matches(selectors.userMessage) ? 'user' : matches(selectors.assistantMessage) ? 'assistant' : null;
    const content = node.textContent || '';
    if (role && content.trim()) out.push({ role, content, node });
  }
  return out;
}

export function initSessionMonitor(platformInfo) {
  if (!platformInfo?.isLLMPlatform || !platformInfo.selectors) return () => {};
  const selectors = platformInfo.selectors;
  let engines = { ...DEFAULT_ENGINES };
  let stopped = false;
  let timer;
  let revision = 0;
  let running = false;
  let pending = false;
  let lastSignature = '';
  let counter = 0;
  let url = location.href;
  const emit = (health) => emitContentEvent('sentientcy-session-health-changed', { health });
  async function process() {
    if (running) { pending = true; return; }
    if (!engines.session || stopped) return;
    const turns = snapshotSession(selectors);
    const assistant = [...turns].reverse().find((turn) => turn.role === 'assistant');
    const signature = JSON.stringify(turns.map(({ role, content }) => [role, content]));
    if (!assistant || signature === lastSignature) return;
    const version = revision;
    const pageUrl = location.href;
    const isCurrent = () => !stopped && engines.session && version === revision && location.href === pageUrl
      && turns.every((turn) => turn.node.isConnected && !containsSensitiveContent(turn.node) && turn.node.textContent === turn.content);
    running = true;
    try {
      const threshold = (await storage.getSettings()).confidenceThreshold;
      if (!isCurrent()) return;
      const threat = await analyzeText(assistant.content, ENGINE.SESSION, { skipPersist: true, isCurrent });
      if (!isCurrent()) return;
      lastSignature = signature;
      emit(threat ? 'warning' : 'checked');
      if (threat) await persistAndBroadcastThreat(threat, true);
      counter++;
      if (counter % 3 || turns.length < 2 || !isCurrent()) return;
      const trajectory = await analyzeTrajectory(turns);
      if (!isCurrent()) return;
      if (trajectory.networkError) { emit('unavailable'); return; }
      if (trajectory.trajectory_attack_detected && trajectory.confidence >= threshold) {
        emit('compromised');
        remediateSession(trajectory, platformInfo.platform, selectors, turns.map((turn) => turn.node));
      }
    } catch { if (isCurrent()) emit('unavailable'); }
    finally { running = false; if (pending) { pending = false; void process(); } }
  }
  function schedule() {
    revision++;
    if (location.href !== url) { url = location.href; counter = 0; lastSignature = ''; emit('unknown'); }
    clearTimeout(timer);
    timer = setTimeout(() => void process(), STREAMING_STABLE_MS);
  }
  const stopSettings = watchEngines((value) => { engines = value; emit(value.session ? 'unknown' : 'disabled'); schedule(); });
  const observer = new MutationObserver((records) => {
    if (records.some((record) => !record.target.parentElement?.closest('#sentientcy-host, [data-sentientcy]') && !record.target.closest?.('#sentientcy-host, [data-sentientcy]'))) schedule();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  return () => { stopped = true; revision++; observer.disconnect(); stopSettings(); clearTimeout(timer); };
}
