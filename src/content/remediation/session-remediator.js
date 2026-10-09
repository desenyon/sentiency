export function remediateSession(result, platform, selectors, snapshotNodes) {
  if (!selectors?.messageContainer) return;
  document.getElementById('sentientcy-session-banner')?.remove();
  const turns = snapshotNodes || [...document.querySelectorAll(selectors.messageContainer)];
  if (turns.some((node) => !node.isConnected)) return;
  const banner = document.createElement('div');
  banner.id = 'sentientcy-session-banner';
  banner.setAttribute('data-sentientcy', 'session-banner');
  banner.style.cssText = 'margin:12px;padding:16px;background:#111;color:#fff;border:1px solid #f97316;border-radius:12px;font:13px/1.5 system-ui';
  const title = document.createElement('strong');
  title.textContent = 'Sentiency session alert';
  const description = document.createElement('p');
  description.textContent = result.description || result.attack_type || 'Trajectory risk';
  const advice = document.createElement('p');
  const point = result.safe_truncation_point;
  advice.textContent = point == null ? 'No safe cutoff was identified. Consider starting a new conversation.'
    : `Keep only turns 1–${point}; remove later turns or start a new conversation in ${platform}. Earlier turns outside the analyzed window were not assessed. Sentiency cannot delete provider messages.`;
  banner.append(title, description, advice);
  (turns[0]?.parentElement || document.body).prepend(banner);
  const changed = [];
  turns.forEach((el, index) => {
    if (result.compromised_turns?.includes(index + 1)) {
      const before = el.style.outline;
      el.style.outline = '3px solid #ef4444';
      changed.push([el, before, el.style.outline]);
    }
  });
  const undo = document.createElement('button');
  undo.textContent = 'Dismiss and undo outlines';
  undo.addEventListener('click', () => {
    changed.forEach(([el, before, applied]) => { if (el.style.outline === applied) el.style.outline = before; });
    banner.remove();
  });
  banner.appendChild(undo);
}
