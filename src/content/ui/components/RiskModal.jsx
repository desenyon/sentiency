import React from 'react';
import { LogoMark } from '../../../shared/LogoMark';
import { REMEDIATION_MODES } from '../../../shared/constants';
import { storage } from '../../../shared/storage';
import { getLastPasteContext } from '../../clipboard-context';
import { remediateClipboard } from '../../remediation/clipboard-remediator';
import { safeRuntimeSendMessage } from '../../../shared/extension-context';

function sevPillClass(sev) {
  const k = sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW' ? sev : 'LOW';
  return `sentientcy-sev sentientcy-sev-${k}`;
}

export function RiskModal({ threat, phase, onDismiss, onOpenSide }) {
  if (!threat) return null;

  const phaseLabel = phase === 'copy' ? 'Copy' : phase === 'scan' ? 'Selection' : 'Paste';

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

  const blurb =
    phase === 'copy'
      ? 'Copied text may include adversarial instructions or obfuscation aimed at LLMs.'
      : phase === 'scan'
        ? 'Selected text may include instructions meant to override model behavior.'
        : 'This paste may carry content designed to manipulate the assistant.';

  return (
    <div
      className="sentientcy-modal-root fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sentientcy-risk-title"
    >
      <button
        type="button"
        className="sentientcy-modal-overlay absolute inset-0 backdrop-blur-md"
        aria-label="Dismiss"
        onClick={onDismiss}
      />
      <div
        className="sentientcy-modal-card sentientcy-modal-card-enter relative w-full max-w-md overflow-hidden rounded-2xl ring-1 ring-black/50"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="relative px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="sentientcy-icon-box flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl p-0.5">
                <LogoMark className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="sentientcy-text-faint text-[10px] font-bold uppercase tracking-[0.16em]">Sentiency</p>
                <h2 id="sentientcy-risk-title" className="sentientcy-text-title mt-1 text-lg font-semibold leading-tight tracking-tight sm:text-xl">
                  Risk detected
                </h2>
                <p className="sentientcy-text-muted mt-1 text-[11px] font-medium">{phaseLabel} · review below</p>
              </div>
            </div>
            <span className={`shrink-0 px-2.5 py-1 text-[10px] ${sevPillClass(threat.severity)}`}>{threat.severity}</span>
          </div>

          <p className="sentientcy-text-soft mt-4 text-[13px] leading-relaxed">{blurb}</p>

          <div className="sentientcy-section-rule my-4" />

          <div>
            <p className="sentientcy-section-title">Classification</p>
            <div className="sentientcy-well space-y-2 rounded-xl p-3.5 text-[12px]">
              <div className="sentientcy-text flex gap-2">
                <span className="sentientcy-label shrink-0">Class</span>
                <span className="min-w-0 font-medium">{threat.attackClass || 'Unknown'}</span>
              </div>
              <div className="sentientcy-text flex gap-2">
                <span className="sentientcy-label shrink-0">Technique</span>
                <span className="min-w-0">{threat.technique || 'Heuristic / local'}</span>
              </div>
              <div className="sentientcy-text flex gap-2">
                <span className="sentientcy-label shrink-0">Path</span>
                <span className="min-w-0 break-words">{(threat.taxonomyPath || []).join(' → ') || '—'}</span>
              </div>
              <div className="sentientcy-text flex gap-2">
                <span className="sentientcy-label shrink-0">Confidence</span>
                <span className="font-semibold tabular-nums">{Math.round((threat.confidence || 0) * 100)}%</span>
              </div>
              {threat.intent ? (
                <div className="sentientcy-text border-t border-zinc-700/50 pt-2">
                  <span className="sentientcy-label block">Intent</span>
                  <span className="mt-1 block leading-snug">{threat.intent}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sentientcy-section-rule my-4" />

          <div>
            <p className="sentientcy-section-title">Prefer remediation</p>
            <p className="sentientcy-text-muted mb-2 text-[11px]">Sets default and applies to this paste when possible.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="sentientcy-btn-ghost sentientcy-btn-compact"
                onClick={() => void applyRemediationPreference(REMEDIATION_MODES.SURGICAL)}
              >
                Surgical
              </button>
              <button
                type="button"
                className="sentientcy-btn-ghost sentientcy-btn-compact"
                onClick={() => void applyRemediationPreference(REMEDIATION_MODES.HIGHLIGHT)}
              >
                Highlight
              </button>
              <button
                type="button"
                className="sentientcy-btn-ghost sentientcy-btn-compact"
                onClick={() => void applyRemediationPreference(REMEDIATION_MODES.BLOCK)}
              >
                Block
              </button>
            </div>
          </div>
        </div>

        <div className="sentientcy-modal-footer flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800/80 bg-black/20 px-5 py-3 sm:px-6">
          <button
            type="button"
            className="sentientcy-link sentientcy-link-footer"
            onClick={() => {
              safeRuntimeSendMessage({ type: 'OPEN_SIDE_PANEL' });
              onOpenSide?.();
            }}
          >
            Side panel
          </button>
          <button type="button" className="sentientcy-btn-primary sentientcy-btn-primary-wide" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
