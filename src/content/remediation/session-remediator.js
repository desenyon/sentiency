function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function remediateSession(trajectoryResult, platform, selectors) {
  if (!selectors || !selectors.messageContainer) return;

  const existing = document.getElementById('sentientcy-session-banner');
  existing?.remove();

  const container = document.querySelector(selectors.messageContainer)?.parentElement || document.body;
  const banner = document.createElement('div');
  banner.id = 'sentientcy-session-banner';
  banner.setAttribute('data-sentientcy', 'session-banner');
  banner.style.cssText =
    'margin:12px 0;padding:14px 16px;background:#0f0f12;color:#e4e4ea;border:1px solid #f97316;border-radius:12px;font:13px/1.5 system-ui;';
  const path = trajectoryResult.description || trajectoryResult.attack_type || 'Trajectory risk';
  banner.innerHTML = `
    <div style="font-weight:600;color:#fb923c;margin-bottom:6px">Sentiency session alert</div>
    <div>${escapeHtml(path)}</div>
    <div style="margin-top:8px;opacity:.9">Confidence: ${Math.round((Number(trajectoryResult.confidence) || 0) * 100)}%</div>
    <button type="button" id="sentientcy-truncate-advice" style="margin-top:12px;padding:8px 14px;border-radius:8px;border:1px solid #2dd4bf;background:#134e4a;color:#e4e4ea;cursor:pointer;font-weight:600">
      Truncate conversation to safe point
    </button>
    <p style="margin-top:10px;font-size:12px;opacity:.8">Extensions cannot delete provider messages. Start a new chat or remove turns from turn ${escapeHtml(String(trajectoryResult.safe_truncation_point || '?'))} onward.</p>
  `;
  const firstTurn = document.querySelector(selectors.messageContainer);
  if (firstTurn && firstTurn.parentNode) {
    firstTurn.parentNode.insertBefore(banner, firstTurn);
  } else {
    container.prepend(banner);
  }

  banner.querySelector('#sentientcy-truncate-advice')?.addEventListener('click', () => {
    window.alert(
      `Suggested safe truncation: keep only turns 1–${trajectoryResult.safe_truncation_point || 'N'}. Start a new conversation in ${platform} and avoid continuing this thread.`,
    );
  });

  const turns = document.querySelectorAll(selectors.messageContainer);
  const compromised = trajectoryResult.compromised_turns || [];
  turns.forEach((el, idx) => {
    if (compromised.includes(idx + 1)) {
      el.setAttribute(
        'style',
        `${el.getAttribute('style') || ''};border-left:4px solid #ef4444;padding-left:8px;`,
      );
    }
  });
}
