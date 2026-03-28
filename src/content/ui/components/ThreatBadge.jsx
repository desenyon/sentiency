import React from 'react';

const dot = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-blue-500',
};

export function ThreatBadge({ threat, onActivate }) {
  if (!threat) return null;
  const abbr = (threat.attackClass || 'Threat').slice(0, 3).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onActivate?.(threat)}
      className="inline-flex items-center gap-1 rounded-full border border-matte-700 bg-matte-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-matte-200 hover:border-teal-700"
      title={threat.attackClass || ''}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[threat.severity] || 'bg-matte-500'}`} />
      {abbr}
    </button>
  );
}
