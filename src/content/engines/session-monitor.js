import { analyzeText, analyzeTrajectory } from '../../pipeline/threat-pipeline';
import { remediateSession } from '../remediation/session-remediator';
import { ENGINE, STREAMING_STABLE_MS } from '../../shared/constants';
import { storage } from '../../shared/storage';
import { safeRuntimeSendMessage } from '../../shared/extension-context';

function classifyTurn(el, selectors) {
  if (!el || !selectors) return null;
  try {
    if (selectors.userMessage && el.querySelector(selectors.userMessage)) return 'user';
    if (selectors.assistantMessage && el.querySelector(selectors.assistantMessage)) return 'assistant';
  } catch {
    return null;
  }
  return null;
}

function turnText(el) {
  return (el.textContent || '').trim();
}

export function initSessionMonitor(platformInfo) {
  if (!platformInfo?.isLLMPlatform || !platformInfo.selectors) return () => {};

  let tabId = null;
  let health = 'safe';
  let lastAssistantSig = '';
  let stableTimer = null;
  let pendingText = '';
  let observer = null;
  let trajCounter = 0;

  const emitHealth = () => {
    window.dispatchEvent(new CustomEvent('sentientcy-session-health-changed', { detail: { health } }));
  };

  safeRuntimeSendMessage({ type: 'GET_TAB_ID' }, (res) => {
    tabId = res?.tabId ?? null;
  });

  const selectors = platformInfo.selectors;
  const root =
    document.querySelector(selectors.messageContainer)?.closest('main') ||
    document.querySelector('main') ||
    document.body;

  const snapshotTurns = () => {
    const nodes = Array.from(document.querySelectorAll(selectors.messageContainer));
    const out = [];
    nodes.forEach((node) => {
      const role = classifyTurn(node, selectors);
      if (!role) return;
      const content = turnText(node);
      if (!content) return;
      out.push({ role, content });
    });
    return out;
  };

  const processAssistantStable = async (text) => {
    const engines = await storage.getEngines();
    if (!engines.session) return;
    if (!text || text === lastAssistantSig) return;
    lastAssistantSig = text;

    const settings = await storage.getSettings();
    const threshold =
      typeof settings.confidenceThreshold === 'number' ? settings.confidenceThreshold : 0.65;

    const conv = snapshotTurns();
    if (tabId != null) {
      await storage.setSessionHistory(tabId, conv);
    }

    const threat = await analyzeText(text, ENGINE.SESSION);
    if (threat) {
      health = threat.severity === 'CRITICAL' || threat.severity === 'HIGH' ? 'compromised' : 'warning';
      emitHealth();
    }

    trajCounter++;
    if (trajCounter % 3 !== 0) return;
    if (conv.length < 2) return;

    const traj = await analyzeTrajectory(conv);
    const ok = traj && !traj.parseError && !traj.networkError;
    const conf = ok ? Number(traj.confidence) || 0 : 0;
    if (ok && traj.trajectory_attack_detected && conf >= threshold) {
      health = 'compromised';
      emitHealth();
      remediateSession(traj, platformInfo.platform, selectors);
    }
  };

  const onMutations = () => {
    const turns = snapshotTurns();
    const lastAsst = [...turns].reverse().find((t) => t.role === 'assistant');
    if (!lastAsst) return;
    const t = lastAsst.content;
    pendingText = t;
    clearTimeout(stableTimer);
    stableTimer = setTimeout(() => {
      processAssistantStable(pendingText);
    }, STREAMING_STABLE_MS);
  };

  observer = new MutationObserver(onMutations);
  observer.observe(root, { subtree: true, childList: true, characterData: true });

  onMutations();
  emitHealth();

  return () => {
    observer?.disconnect();
    clearTimeout(stableTimer);
  };
}
