import { mergeAndClampSpans, spansToHighlightedHtml } from '../../shared/span-utils';
import { REMEDIATION_MODES } from '../../shared/constants';

const WRAP_ATTR = 'data-sentientcy-input-wrap';

function copyRelevantStyles(fromEl, toEl) {
  const cs = window.getComputedStyle(fromEl);
  const keys = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'boxSizing',
    'width',
    'minHeight',
    'maxHeight',
    'whiteSpace',
    'wordBreak',
    'overflowWrap',
    'tabSize',
  ];
  keys.forEach((k) => {
    toEl.style[k] = cs[k];
  });
  toEl.style.whiteSpace = 'pre-wrap';
  toEl.style.wordWrap = 'break-word';
  toEl.style.overflowWrap = 'break-word';
}

function resolveBackground(el) {
  let cur = el;
  for (let d = 0; d < 8 && cur; d++) {
    const bg = window.getComputedStyle(cur).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    cur = cur.parentElement;
  }
  return 'rgba(15,15,18,0.96)';
}

export function teardownFieldHighlight(inputRoot) {
  if (!inputRoot) return;
  const wrap = inputRoot.closest?.(`[${WRAP_ATTR}]`);
  if (wrap) {
    if (typeof wrap._sentientcyCleanup === 'function') {
      try {
        wrap._sentientcyCleanup();
      } catch {
        /* ignore */
      }
    }
    const parent = wrap.parentElement;
    if (parent) {
      parent.insertBefore(inputRoot, wrap);
      wrap.remove();
    }
  }
  inputRoot.style.color = '';
  inputRoot.style.background = '';
  inputRoot.style.caretColor = '';
  inputRoot.style.textShadow = '';
  inputRoot.style.webkitTextFillColor = '';
  inputRoot.style.gridArea = '';
  inputRoot.style.zIndex = '';
  inputRoot.style.position = '';
}

export function attachFieldHighlight(inputRoot, plainText, spans, threat, mode) {
  if (!inputRoot || mode === REMEDIATION_MODES.BLOCK || mode === REMEDIATION_MODES.SURGICAL) return;

  teardownFieldHighlight(inputRoot);

  const highlightSpans = mergeAndClampSpans(spans, plainText.length);
  if (!highlightSpans.length) return;

  const parent = inputRoot.parentElement;
  if (!parent) return;

  const wrap = document.createElement('div');
  wrap.setAttribute(WRAP_ATTR, '1');
  wrap.setAttribute('data-sentientcy', 'wrap');
  wrap.style.cssText =
    'display:grid;grid-template-columns:1fr;grid-template-rows:1fr;position:relative;width:100%;align-self:stretch;';

  const sheet = document.createElement('style');
  sheet.textContent = `
    @keyframes sentientcy-hl-pulse {
      0%, 100% { box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.35); }
      50% { box-shadow: inset 0 0 0 1px rgba(252, 165, 165, 0.85); }
    }
    .sentientcy-mirror mark.sentientcy-hl-mark,
    .sentientcy-mirror [data-sentientcy="hl"] {
      background: linear-gradient(180deg, rgba(239,68,68,0.55), rgba(220,38,38,0.65));
      color: #fff;
      border-radius: 3px;
      padding: 0 2px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      animation: sentientcy-hl-pulse 2.4s ease-in-out infinite;
    }
  `;

  const mirror = document.createElement('div');
  mirror.className = 'sentientcy-mirror';
  mirror.setAttribute('data-sentientcy', 'mirror');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText =
    'grid-area:1/1;z-index:0;overflow:auto;pointer-events:none;user-select:none;border-radius:inherit;';
  copyRelevantStyles(inputRoot, mirror);
  mirror.style.background = resolveBackground(inputRoot);
  mirror.style.color = '#e4e4ea';
  mirror.innerHTML = spansToHighlightedHtml(plainText, highlightSpans);

  const flagBar = document.createElement('div');
  flagBar.setAttribute('data-sentientcy', 'flags');
  flagBar.style.cssText =
    'position:absolute;right:6px;top:6px;z-index:4;display:flex;flex-wrap:wrap;gap:4px;max-width:48%;justify-content:flex-end;pointer-events:none;';

  const n = highlightSpans.length;
  const chip = document.createElement('span');
  chip.style.cssText =
    'font:11px/1.2 system-ui;padding:3px 8px;border-radius:999px;background:rgba(185,28,28,0.95);color:#fff;border:1px solid rgba(248,113,113,0.5);font-weight:600;';
  chip.textContent = `${n} flagged segment${n === 1 ? '' : 's'}`;
  flagBar.appendChild(chip);
  if (threat?.severity) {
    const sev = document.createElement('span');
    sev.style.cssText =
      'font:10px/1 system-ui;padding:2px 6px;border-radius:999px;background:rgba(15,15,18,0.92);color:#fca5a5;border:1px solid #7f1d1d;text-transform:uppercase;letter-spacing:0.04em;';
    sev.textContent = threat.severity;
    flagBar.appendChild(sev);
  }

  parent.insertBefore(wrap, inputRoot);
  wrap.appendChild(sheet);
  wrap.appendChild(mirror);
  wrap.appendChild(flagBar);
  wrap.appendChild(inputRoot);

  inputRoot.style.gridArea = '1 / 1';
  inputRoot.style.zIndex = '1';
  inputRoot.style.position = 'relative';
  inputRoot.style.background = 'transparent';
  const caret = window.getComputedStyle(inputRoot).caretColor;
  inputRoot.style.caretColor = caret && caret !== 'transparent' ? caret : '#fff';
  inputRoot.style.color = 'transparent';
  inputRoot.style.textShadow = 'none';
  inputRoot.style.webkitTextFillColor = 'transparent';

  const syncScroll = () => {
    mirror.scrollTop = inputRoot.scrollTop;
    mirror.scrollLeft = inputRoot.scrollLeft;
  };
  inputRoot.addEventListener('scroll', syncScroll, { passive: true });
  syncScroll();

  const ro = new ResizeObserver(() => {
    mirror.style.height = `${inputRoot.clientHeight}px`;
    mirror.style.width = `${inputRoot.clientWidth}px`;
  });
  ro.observe(inputRoot);
  mirror.style.height = `${inputRoot.clientHeight}px`;
  mirror.style.width = `${inputRoot.clientWidth}px`;

  let debounce;
  const onEdit = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const now =
        inputRoot.tagName === 'TEXTAREA' || inputRoot.tagName === 'INPUT'
          ? inputRoot.value || ''
          : (inputRoot.innerText || inputRoot.textContent || '').replace(/\u00a0/g, ' ');
      if (now !== plainText) {
        ro.disconnect();
        inputRoot.removeEventListener('scroll', syncScroll);
        inputRoot.removeEventListener('input', onEdit);
        inputRoot.removeEventListener('keyup', onEdit);
        teardownFieldHighlight(inputRoot);
      } else {
        syncScroll();
      }
    }, 450);
  };
  inputRoot.addEventListener('input', onEdit, { passive: true });
  inputRoot.addEventListener('keyup', onEdit, { passive: true });

  wrap._sentientcyCleanup = () => {
    ro.disconnect();
    inputRoot.removeEventListener('scroll', syncScroll);
    inputRoot.removeEventListener('input', onEdit);
    inputRoot.removeEventListener('keyup', onEdit);
    clearTimeout(debounce);
  };
}
