import React, { useEffect, useState } from 'react';
import { LogoMark } from '../../../shared/LogoMark';

export function SessionHealthBar({ onOpenPanel }) {
  const [health, setHealth] = useState('safe');

  useEffect(() => {
    const fn = (e) => setHealth(e.detail?.health || 'safe');
    window.addEventListener('sentientcy-session-health-changed', fn);
    return () => window.removeEventListener('sentientcy-session-health-changed', fn);
  }, []);

  const sessionClass =
    health === 'compromised' ? 'bad' : health === 'warning' ? 'warn' : 'safe';

  const label =
    health === 'compromised'
      ? 'Session compromised — review trajectory alert'
      : health === 'warning'
        ? 'Potential threat detected in this session'
        : 'Session safe';

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
      className={`sentientcy-session fixed left-3 right-3 top-3 z-[2147483645] flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 shadow-panel transition hover:brightness-110 ${sessionClass}`}
    >
      <span className="sentientcy-icon-box flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg p-0.5">
        <LogoMark className="h-full w-full" />
      </span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="sentientcy-text flex-1 text-left text-[13px] font-medium tracking-tight">{label}</span>
      <span className="sentientcy-text-muted text-[11px]">Open panel</span>
    </button>
  );
}
