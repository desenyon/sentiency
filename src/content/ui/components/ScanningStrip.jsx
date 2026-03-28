import React from 'react';

const LABEL = {
  paste: 'Analyzing paste…',
  copy: 'Analyzing copy…',
  dom: 'Scanning page…',
  scan: 'Scanning selection…',
};

export function ScanningStrip({ phase }) {
  if (!phase) return null;
  return (
    <div className="sentientcy-scanning sentientcy-scanning-enhanced" role="status" aria-live="polite">
      <span className="sentientcy-scanning-dots" aria-hidden>
        <span className="sentientcy-scanning-dot" />
        <span className="sentientcy-scanning-dot sentientcy-scanning-dot-2" />
        <span className="sentientcy-scanning-dot sentientcy-scanning-dot-3" />
      </span>
      <span className="sentientcy-scanning-label">{LABEL[phase] || 'Analyzing…'}</span>
    </div>
  );
}
