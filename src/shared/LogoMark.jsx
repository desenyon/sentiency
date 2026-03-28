import React from 'react';
import { isExtensionContextValid } from './extension-context';

export function LogoMark({ className = 'h-9 w-9' }) {
  let src = '';
  try {
    if (isExtensionContextValid()) {
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
