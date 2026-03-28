import React, { useEffect, useMemo, useState } from 'react';
import { ENGINE, REMEDIATION_MODES } from '../../../shared/constants';
import { threatSourceLabel } from '../../../shared/engine-labels';
import { storage } from '../../../shared/storage';
import { buildSurgicalText, resolveRemovalSpans } from '../../../shared/removal-spans';
import { getLastPasteContext } from '../../clipboard-context';
import { remediateClipboard } from '../../remediation/clipboard-remediator';
import { TaxonomyTree } from './TaxonomyTree';
import { LogoMark } from '../../../shared/LogoMark';
import { safeRuntimeSendMessage } from '../../../shared/extension-context';

function sevClass(sev) {
  const k = sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW' ? sev : 'LOW';
  return `sentientcy-sev sentientcy-sev-${k}`;
}

const PREVIEW_MAX = 8000;

export function ThreatPanel({ threat, onDismiss, storageRev = 0 }) {
  const [open, setOpen] = useState(true);
  const [previewTab, setPreviewTab] = useState('original');
  const [livePulse, setLivePulse] = useState(false);

  useEffect(() => {
    setPreviewTab('original');
  }, [threat?.id]);

  useEffect(() => {
    if (!storageRev) return;
    setLivePulse(true);
    const t = window.setTimeout(() => setLivePulse(false), 1000);
    return () => window.clearTimeout(t);
  }, [storageRev]);

  const fullText = threat?.originalText || '';
  const removalSpans = useMemo(() => (threat ? resolveRemovalSpans(fullText, threat) : []), [fullText, threat]);
  const cleanedPreview = useMemo(
    () => (threat ? buildSurgicalText(fullText, removalSpans) : ''),
    [fullText, threat, removalSpans],
  );

  if (!threat || !open) return null;

  async function applyFromPanel(mode) {
    await storage.setRemediationMode(mode);
    if (threat.source === ENGINE.CLIPBOARD) {
      const ctx = getLastPasteContext();
      if (ctx?.threat?.id === threat.id && ctx.inputRoot?.isConnected) {
        try {
          await remediateClipboard(ctx.pastedText, ctx.threat, ctx.inputRoot, mode);
        } catch {
          /* ignore */
        }
      }
    }
  }

  const pct = Math.round((threat.confidence || 0) * 100);
  const dec = threat.decodedText ? String(threat.decodedText).slice(0, 200) : null;
  const snippet = (previewTab === 'cleaned' ? cleanedPreview : fullText).slice(0, 200);
  const trimmedOriginal = fullText.length > PREVIEW_MAX ? `${fullText.slice(0, PREVIEW_MAX)}…` : fullText;
  const trimmedCleaned =
    cleanedPreview.length > PREVIEW_MAX ? `${cleanedPreview.slice(0, PREVIEW_MAX)}…` : cleanedPreview;
  const displayBody = previewTab === 'cleaned' ? trimmedCleaned : trimmedOriginal;
  const spanCount = removalSpans.length;

  return (
    <div
      className={`sentientcy-card sentientcy-panel-animate fixed bottom-4 right-4 z-[2147483646] w-[min(100vw-2rem,420px)] rounded-2xl ring-1 ring-black/40 backdrop-blur-md transition-shadow duration-500 ${livePulse ? 'sentientcy-live-pulse' : ''}`}
    >
      <div className="sentientcy-card-header rounded-t-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="sentientcy-icon-box flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl p-0.5">
              <LogoMark className="h-full w-full" />
            </div>
            <div>
              <p className="sentientcy-text-faint text-[11px] font-semibold uppercase tracking-widest">Sentiency</p>
              <p className="sentientcy-text-title text-sm">Threat detected</p>
              <p className="sentientcy-text-muted mt-0.5 text-[10px] tabular-nums" aria-live="polite">
                {spanCount} removal segment{spanCount === 1 ? '' : 's'} · live sync
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sentientcy-btn-close"
            onClick={() => {
              setOpen(false);
              onDismiss?.();
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={sevClass(threat.severity)}>{threat.severity}</span>
          <span className="sentientcy-text-muted text-[12px]">{threatSourceLabel(threat.source)}</span>
        </div>

        <div>
          <p className="sentientcy-text text-[13px] font-medium">{threat.attackClass || 'Unclassified'}</p>
          <p className="sentientcy-text-muted mt-0.5 text-[12px]">{threat.technique || '—'}</p>
        </div>

        <div>
          <p className="sentientcy-text-faint mb-1 text-[11px] uppercase tracking-wide">Taxonomy</p>
          <TaxonomyTree path={threat.taxonomyPath} />
        </div>

        <div>
          <div className="sentientcy-text-muted mb-1 flex justify-between text-[11px]">
            <span>Confidence</span>
            <span className="sentientcy-text">{pct}%</span>
          </div>
          <div className="sentientcy-progress-track">
            <div
              className="sentientcy-progress-fill sentientcy-progress-fill-animated"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {threat.intent ? (
          <p className="sentientcy-text-soft text-[12px] leading-relaxed">
            <span className="sentientcy-text-muted">Intent: </span>
            {threat.intent}
          </p>
        ) : null}

        <div className="sentientcy-well rounded-xl p-3 text-[12px]">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`sentientcy-preview-tab rounded-lg px-2.5 py-1 text-[11px] font-semibold ${previewTab === 'original' ? 'sentientcy-preview-tab-active' : ''}`}
              onClick={() => setPreviewTab('original')}
            >
              Original
            </button>
            <button
              type="button"
              className={`sentientcy-preview-tab rounded-lg px-2.5 py-1 text-[11px] font-semibold ${previewTab === 'cleaned' ? 'sentientcy-preview-tab-active' : ''}`}
              onClick={() => setPreviewTab('cleaned')}
            >
              After surgical
            </button>
          </div>
          <p className="sentientcy-text-faint text-[10px] uppercase tracking-wide">
            {previewTab === 'cleaned' ? 'Surgical output (first 200 chars)' : 'Original (first 200 chars)'}
          </p>
          <p className="sentientcy-text mt-1 whitespace-pre-wrap break-words">{snippet || '—'}</p>
          {previewTab === 'original' && dec ? (
            <>
              <p className="sentientcy-text mt-3 font-semibold">Decoded</p>
              <p className="sentientcy-text mt-1 whitespace-pre-wrap break-words">{dec}</p>
            </>
          ) : null}
          <p className="sentientcy-text-muted mt-3 text-[10px] font-medium uppercase tracking-wide">Full text preview</p>
          <pre
            key={previewTab}
            className="sentientcy-text sentientcy-preview-fade mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/25 p-2 text-[11px] leading-relaxed"
          >
            {displayBody || '—'}
          </pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="sentientcy-btn-ghost" onClick={() => void applyFromPanel(REMEDIATION_MODES.SURGICAL)}>
            Surgical
          </button>
          <button type="button" className="sentientcy-btn-ghost" onClick={() => void applyFromPanel(REMEDIATION_MODES.HIGHLIGHT)}>
            Highlight
          </button>
          <button type="button" className="sentientcy-btn-ghost" onClick={() => void applyFromPanel(REMEDIATION_MODES.BLOCK)}>
            Block
          </button>
        </div>

        <button
          type="button"
          className="sentientcy-link"
          onClick={() => safeRuntimeSendMessage({ type: 'OPEN_SIDE_PANEL' })}
        >
          View all threats in side panel
        </button>
      </div>
    </div>
  );
}
