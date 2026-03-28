const SENTIENTCY_THEME_FALLBACK = `
#sentientcy-mount{font-family:system-ui,sans-serif;color:#e4e4ea!important}
#sentientcy-mount .sentientcy-card{background:#050506!important;color:#e4e4ea!important;border:1px solid #26262e!important}
#sentientcy-mount .sentientcy-card-header{border-bottom:1px solid #26262e!important;background:rgba(15,15,18,.65)!important}
#sentientcy-mount .sentientcy-text{color:#e4e4ea!important}
#sentientcy-mount .sentientcy-text-title{color:#f4f4f5!important;font-weight:600}
#sentientcy-mount .sentientcy-text-muted{color:#a1a1aa!important}
#sentientcy-mount .sentientcy-text-faint{color:#71717a!important}
#sentientcy-mount .sentientcy-text-soft{color:#d4d4d8!important}
#sentientcy-mount .sentientcy-well{background:#141418!important;border:1px solid #3a3a44!important;color:#e4e4ea!important}
#sentientcy-mount .sentientcy-taxo{background:#141418!important;border:1px solid #3a3a44!important;color:#e4e4ea!important}
#sentientcy-mount .sentientcy-taxo-node{color:#d4d4d8!important;background:transparent!important;border:none!important;width:100%;text-align:left}
#sentientcy-mount .sentientcy-taxo-node.is-active{background:rgba(19,78,74,.45)!important;color:#99f6e4!important}
#sentientcy-mount .sentientcy-taxo-desc{color:#a1a1aa!important}
#sentientcy-mount .sentientcy-btn-ghost{background:#27272a!important;color:#e4e4ea!important;border:1px solid #3f3f46!important;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer}
#sentientcy-mount .sentientcy-btn-close{background:transparent!important;color:#a1a1aa!important;border:none!important;font-size:18px;cursor:pointer;border-radius:8px;padding:4px 8px}
#sentientcy-mount .sentientcy-btn-primary{background:#e4e4ea!important;color:#050506!important;border:none!important;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer}
#sentientcy-mount .sentientcy-link{color:#5eead4!important;background:none;border:none;font-weight:600;cursor:pointer;font-size:12px}
#sentientcy-mount .sentientcy-modal-overlay{z-index:0!important;background:rgba(0,0,0,.78)!important}
#sentientcy-mount .sentientcy-modal-card{position:relative!important;z-index:1!important;pointer-events:auto!important;background:#050506!important;color:#e4e4ea!important;border:1px solid #3a3a44!important}
#sentientcy-mount .sentientcy-scanning{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);z-index:2147483645;padding:10px 20px;border-radius:999px;background:#0a0a0c!important;border:1px solid rgba(45,212,191,.55)!important;color:#e4e4ea!important;font:13px system-ui;font-weight:500}
#sentientcy-mount .sentientcy-sev{font-size:11px;font-weight:700;text-transform:uppercase;padding:4px 10px;border-radius:999px;color:#fff!important}
#sentientcy-mount .sentientcy-sev-CRITICAL{background:linear-gradient(90deg,#dc2626,#991b1b)!important}
#sentientcy-mount .sentientcy-sev-HIGH{background:linear-gradient(90deg,#ea580c,#9a3412)!important}
#sentientcy-mount .sentientcy-sev-MEDIUM{background:linear-gradient(90deg,#ca8a04,#854d0e)!important}
#sentientcy-mount .sentientcy-sev-LOW{background:linear-gradient(90deg,#2563eb,#1e3a8a)!important}
#sentientcy-mount .sentientcy-icon-box{border:1px solid #52525b!important;background:#18181b!important}
#sentientcy-mount .sentientcy-progress-track{height:8px;overflow:hidden;border-radius:999px;background:#27272a!important}
#sentientcy-mount .sentientcy-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#dc2626,#991b1b)!important}
`;

export async function initShadowHost() {
  const id = 'sentientcy-host';
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement('div');
    host.id = id;
    host.setAttribute('data-sentientcy', 'host');
    document.body.appendChild(host);
  }

  if (!host.shadowRoot) {
    host.attachShadow({ mode: 'open' });
  }
  const shadow = host.shadowRoot;
  while (shadow.firstChild) shadow.removeChild(shadow.firstChild);

  let cssText = '';
  let bundleOk = false;
  try {
    const url = chrome.runtime.getURL('content.css');
    const res = await fetch(url);
    bundleOk = res.ok;
    cssText = bundleOk ? await res.text() : '';
  } catch {
    cssText = '';
  }

  const style = document.createElement('style');
  style.textContent = cssText;
  shadow.appendChild(style);

  if (!bundleOk || cssText.length < 400 || !cssText.includes('sentientcy-card')) {
    const fb = document.createElement('style');
    fb.textContent = SENTIENTCY_THEME_FALLBACK;
    shadow.appendChild(fb);
  }

  const mount = document.createElement('div');
  mount.id = 'sentientcy-mount';
  shadow.appendChild(mount);

  return { shadow, mount };
}
