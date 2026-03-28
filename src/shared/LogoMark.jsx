import React from 'react';

export function LogoMark({ className = 'h-9 w-9' }) {
  let src = '';
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      src = chrome.runtime.getURL('icons/logo.png');
    }
  } catch {
    src = '';
  }
  if (!src) return null;
  return (
    <img
      src={src}
      alt="Sentiency"
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}
