import React from 'react';
import { LogoMark } from '../../../shared/LogoMark';
import { REMEDIATION_MODES } from '../../../shared/constants';
import { storage } from '../../../shared/storage';
import { getLastPasteContext } from '../../clipboard-context';
import { remediateClipboard } from '../../remediation/clipboard-remediator';

function sevPillClass(sev) {
  const k = sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW' ? sev : 'LOW';
  return `sentientcy-sev sentientcy-sev-${k}`;
}

export function RiskModal({ threat, phase, onDismiss, onOpenSide }) {
  if (!threat) return null;

  const phaseLabel = phase === 'copy' ? 'Copy' : phase === 'scan' ? 'Selection scan' : 'Paste';

  async function applyRemediationPreference(mode) {
    await storage.setRemediationMode(mode);
    if (phase === 'paste') {
      const ctx = getLastPasteContext();
      if (ctx?.threat?.id === threat.id && ctx.inputRoot?.isConnected) {
        try {
          await remediateClipboard(ctx.pastedText, ctx.threat, ctx.inputRoot, mode);
        } catch {
          /* ignore */
        }
      }
    }
    onDismiss?.();
  }

  return (
    <div
      className="sentientcy-modal-root fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sentientcy-risk-title"
    >
      <button type="button" className="sentientcy-modal-overlay absolute inset-0 backdrop-blur-sm" aria-label="Dismiss overlay" onClick={onDismiss} />
      <div
        className="sentientcy-modal-card sentientcy-modal-card-enter relative w-full max-w-lg overflow-hidden rounded-2xl ring-1 ring-black/50"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="sentientcy-icon-box flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl p-0.5">
                <LogoMark className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="sentientcy-text-faint text-[11px] font-semibold uppercase tracking-[0.2em]">Sentiency</p>
                <h2 id="sentientcy-risk-title" className="sentientcy-text-title mt-1 text-xl tracking-tight">
                  Prompt injection risk ({phaseLabel})
                </h2>
              </div>
            </div>
            <span className={`shrink-0 px-3 py-1 ${sevPillClass(threat.severity)}`}>{threat.severity}</span>
          </div>

          <p className="sentientcy-text-soft mt-4 text-[13px] leading-relaxed">
            {phase === 'copy'
              ? 'The text you copied may contain adversarial instructions or hidden obfuscation targeting LLMs.'
              : phase === 'scan'
                ? 'The selected text may contain adversarial instructions or obfuscation.'
                : 'Intercepted paste may carry instructions meant to override model behavior.'}
          </p>

          <div className="sentientcy-well mt-4 space-y-2 rounded-xl p-4 text-[12px]">
            <div className="sentientcy-text">
              <span className="sentientcy-label">Class: </span>
              {threat.attackClass || 'Unknown'}
            </div>
            <div className="sentientcy-text">
              <span className="sentientcy-label">Technique: </span>
              {threat.technique || 'Heuristic / local'}
            </div>
            <div className="sentientcy-text">
              <span className="sentientcy-label">Path: </span>
              {(threat.taxonomyPath || []).join(' / ') || '—'}
            </div>
            <div className="sentientcy-text">
              <span className="sentientcy-label">Confidence: </span>
              {Math.round((threat.confidence || 0) * 100)}%
            </div>
            {threat.intent ? (
              <div className="sentientcy-text">
                <span className="sentientcy-label">Intent: </span>
                {threat.intent}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="sentientcy-btn-ghost" onClick={() => void applyRemediationPreference(REMEDIATION_MODES.SURGICAL)}>
              Prefer surgical mode
            </button>
            <button type="button" className="sentientcy-btn-ghost" onClick={() => void applyRemediationPreference(REMEDIATION_MODES.HIGHLIGHT)}>
              Prefer highlight mode
            </button>
            <button type="button" className="sentientcy-btn-ghost" onClick={() => void applyRemediationPreference(REMEDIATION_MODES.BLOCK)}>
              Prefer block mode
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              className="sentientcy-link text-[13px]"
              onClick={() => {
                chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, () => void chrome.runtime.lastError);
                onOpenSide?.();
              }}
            >
              Open side panel
            </button>
            <button type="button" className="sentientcy-btn-primary" onClick={onDismiss}>
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
