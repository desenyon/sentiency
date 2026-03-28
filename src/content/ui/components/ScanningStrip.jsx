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
    <div className="sentientcy-scanning" role="status" aria-live="polite">
      <span className="sentientcy-scanning-dot" aria-hidden />
      <span>{LABEL[phase] || 'Analyzing…'}</span>
    </div>
  );
}
