import React, { useEffect, useState } from 'react';
import { LogoMark } from '../../../shared/LogoMark';

export function SessionHealthBar({ onOpenPanel }) {
  const [health, setHealth] = useState('safe');
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    const fn = (e) => setHealth(e.detail?.health || 'safe');
    window.addEventListener('sentientcy-session-health-changed', fn);
    return () => window.removeEventListener('sentientcy-session-health-changed', fn);
  }, []);

  useEffect(() => {
    setTransitionKey((k) => k + 1);
  }, [health]);

  const sessionClass =
    health === 'compromised' ? 'bad' : health === 'warning' ? 'warn' : 'safe';

  const label =
    health === 'compromised'
      ? 'Session may be compromised — open panel for details'
      : health === 'warning'
        ? 'Potential threat in this chat session'
        : 'Session looks healthy';

  const dotClass =
    health === 'compromised'
      ? 'sentientcy-dot-red'
      : health === 'warning'
        ? 'sentientcy-dot-amber'
        : 'sentientcy-dot-green';

  return (
    <button
      type="button"
      onClick={() => onOpenPanel?.()}
      className={`sentientcy-session sentientcy-session-v2 fixed left-3 right-3 top-3 z-[2147483645] flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 shadow-panel ring-1 ring-white/5 transition duration-300 hover:ring-teal-500/20 ${sessionClass}`}
    >
      <span className="sentientcy-icon-box flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl p-0.5">
        <LogoMark className="h-full w-full" />
      </span>
      <span
        key={transitionKey}
        className={`sentientcy-session-pulse-dot h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
        aria-hidden
      />
      <span className="sentientcy-text min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug tracking-tight">
        {label}
      </span>
      <span className="sentientcy-chip rounded-lg bg-black/25 px-2 py-1 text-[11px] font-semibold ring-1 ring-white/10">
        Panel
      </span>
    </button>
  );
}
