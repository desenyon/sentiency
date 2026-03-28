# Sentiency

**Sentiency** is a **Chrome Manifest V3** browser extension that detects, classifies, and remediates **prompt injection** and related adversarial content in real time. It runs **entirely in the browser**: there is **no backend server**. Classification uses the **Google Gemini** REST API (`generateContent`) with an API key the user stores in `chrome.storage.local`.

This document is written for **human developers** and as **handoff context for other coding agents**.

---

## High-level behavior

1. **DOM engine** — Watches the page with `MutationObserver`, focuses on **visually hidden** text (CSS concealment), runs the threat pipeline, and can remediate confirmed injections in the DOM.
2. **Clipboard engine** — Intercepts **paste** (and handles **image** pastes) on analyzable targets, runs analysis before content reaches the field, then sanitizes, blocks, or inserts content per settings.
3. **Copy engine** — On **copy**, scans selected text if it exceeds a minimum length.
4. **Session engine** (LLM sites only) — Observes assistant message streaming/stability, runs **single-turn** analysis on stable assistant text and **trajectory** analysis over a sliding window of conversation turns; can trigger session remediation UI.
5. **Manual scan** — **Context menu** (“Scan selection with Sentiency”) and **keyboard command** send messages to the active tab’s content script, which runs `analyzeText` on the selection.
6. **Image scan** — **Clipboard image paste** (editable targets) and **sidebar file upload** call `analyzeImage` (Gemini **multimodal** with `inlineData`).

All engines feed a shared **threat pipeline** that merges **local heuristics** + **Gemini JSON output**, maps to an internal **taxonomy**, scores **severity**, persists threats, and notifies the UI / service worker.

---

## Technology stack

| Layer | Technology |
|--------|------------|
| Extension platform | Chrome **Manifest V3** (service worker, content scripts, side panel, options page) |
| UI | **React 18**, **react-dom**; content-script UI mounted in **Shadow DOM** (`src/content/ui/shadow-host.js`) with extracted CSS (`content.css`) to avoid page style bleed |
| Styling | **Tailwind CSS 3** (via PostCSS) for options and side panel; separate **panel.css** for shadow UI |
| Bundling | **Webpack 5** + **Babel** (`@babel/preset-env`, `@babel/preset-react`) |
| Build artifacts | Output in **`dist/`** — load **unpacked** from `dist/` in `chrome://extensions` |
| LLM API | **fetch** to `https://generativelanguage.googleapis.com/v1beta/models/<MODEL>:generateContent` |
| Model | **`gemini-3.1-flash-lite-preview`** (constant `GEMINI_MODEL` in `src/shared/constants.js`) |
| Storage | **`chrome.storage.local`** (API key, settings, per-tab session history, threat log) |
| PDF / OCR (npm only) | **`pdfjs-dist`**, **`tesseract.js`** are listed in `package.json` but **are not imported anywhere under `src/`** in the current tree — treat as **unused / planned** unless wired in later |

---

## Algorithms and detection logic (concise)

### Local detectors (no network)

These run in parallel where applicable (`Promise.all` in `analyzeText` / post-processing for `analyzeImage` on extracted text):

| Module | Role |
|--------|------|
| `visibility-analyzer.js` | Flags “hidden” elements: `display:none`, `visibility:hidden`, opacity 0, tiny font, fg/bg color match, clip/clip-path, offscreen positioning, huge negative `text-indent`, zero-size box with text, etc. DOM scanner only analyzes elements that appear **hidden**. |
| `unicode-detector.js` | Zero-width / homoglyph-style anomalies (uses `ZERO_WIDTH_CHARS`, `HOMOGLYPH_MAP` from constants). |
| `instruction-pattern.js` | Substring scan over `INSTRUCTION_KEYWORDS` + imperative regex; produces a **suspicion score** in `[0,1]`. |
| `encoding-detector.js` | Heuristics for base64-like blobs, char-array obfuscation, Morse-like patterns, etc. |
| `obfuscation-unwrapper.js` | Uses encoding findings to produce a **decoded** string when applicable. |
| `injection-block-spans.js` / `removal-spans.js` / `span-utils.js` | Merge, clamp, and augment **character spans** for remediation highlighting and removal. |

### Gemini classification

- **Endpoint**: `GEMINI_API_URL` in `src/shared/constants.js` (same model as above).
- **Client**: `src/classifier/gemini-client.js`
  - `postGeminiContents(parts)` — builds `{ contents: [{ parts }], generationConfig }` with `temperature: 0.1`, `topP: 0.95`, `maxOutputTokens: 2048`.
  - Retries up to **3** attempts with exponential backoff on failure.
  - Parses **first candidate** text parts, strips optional markdown code fences, **`JSON.parse`**.
  - **Text**: `callGemini(prompt)` → single text part.
  - **Image**: `callGeminiWithImage(prompt, mimeType, base64Data)` → text part + part `{ inlineData: { mimeType, data } }` (camelCase for REST JSON).

### Prompt programs (`src/classifier/prompts/`)

| File | Purpose |
|------|---------|
| `single-turn-classify.js` | `buildSingleTurnPrompt(text, decodedText?)` — JSON schema: `injection_detected`, `confidence`, `attack_class`, `technique`, `injection_spans`, `intent`, `reasoning`. Taxonomy class names injected from `TAXONOMY_CLASS_NAMES`. |
| `image-classify.js` | `buildImageClassifyPrompt()` — same style; adds `extracted_visible_text` and spans **relative to extracted text** (model acts as OCR + classifier). |
| `trajectory-classify.js` | `buildTrajectoryPrompt(turns)` — JSON: `trajectory_attack_detected`, `confidence`, `attack_type`, turn indices, `safe_truncation_point`, etc. Explicitly mentions Crescendo, Deceptive Delight, in-session protocol setup, etc. |

### Threat pipeline (`src/pipeline/threat-pipeline.js`)

**`analyzeText(text, source, options)`**

1. Load settings; threshold = `settings.confidenceThreshold` or default **`CONFIDENCE_THRESHOLD` (0.65)**.
2. Run unicode + instruction + encoding detectors; optionally `unwrapObfuscation`.
3. **Gemini gating**: call classifier if there is any local signal **or** text length **> 150** **or** `forceClassifier` **or** source is `CLIPBOARD` / `SCAN` / `COPY`.
4. **Confirmation**: threat if `(Gemini says injection && confidence ≥ threshold)` **or** `instruction.suspicionScore ≥ 0.8` (even if Gemini weak).
5. Map `attack_class` / `technique` via `taxonomy-mapper.js`; severity via `severity-scorer.js`; build threat object with spans; **`persistAndBroadcastThreat`**.

**`analyzeImage(mimeType, base64Data, source, options)`**

1. Vision prompt + `callGeminiWithImage`.
2. If `injection_detected` and confidence ≥ threshold, use `extracted_visible_text` (or placeholder label) as `originalText` for downstream local detectors and span logic.
3. Threat includes **`previewImageDataUrl`** for UI.
4. `dispatchWindowEvent` can be disabled (e.g. side panel upload) so the content script does not rely on `window` events there.

**`analyzeTrajectory(turns)`**

- Takes last **`TRAJECTORY_WINDOW` (12)** turns, builds trajectory prompt, returns parsed Gemini JSON (used by session monitor).

### Severity (`severity-scorer.js`)

- Bands from **confidence**: ≥0.9 → `CRITICAL`, ≥0.75 → `HIGH`, ≥0.6 → `MEDIUM`, else `LOW`.
- If both **unicode anomalies** and **encoding findings**, severity bumps one step up the ordered list.

### Taxonomy (`taxonomy.js`, `taxonomy-mapper.js`)

- Hierarchical **CrowdStrike-style** taxonomy (classes and techniques).
- `mapToTaxonomyPath(attackClass, technique)` prefers valid **technique** names against `VALID_TECHNIQUES`, else falls back to attack class / fuzzy root match.

### Engines (orchestration)

| Engine | File | Trigger / notes |
|--------|------|------------------|
| DOM | `dom-scanner.js` | `MutationObserver` on `document.body`, debounce **`DOM_DEBOUNCE_MS` (250ms)**; full pass aggregates text per element; per-node scans skip `data-sentientcy` subtrees. |
| Clipboard | `clipboard-interceptor.js` | Paste (+ `beforeinput` paths in file); image files → `analyzeImage`; text thresholds from **`PASTE_MIN_CHARS_EDITABLE` (8)**; uses `input-resolve.js` for target roots. |
| Copy | `copy-interceptor.js` | `copy` event (capture); min **`COPY_SCAN_MIN_CHARS` (20)**. |
| Session | `session-monitor.js` | Only if `detectPlatform()` says LLM platform; stable assistant text after **`STREAMING_STABLE_MS` (500ms)**; trajectory every **3rd** processed assistant (`trajCounter % 3 === 0`); history persisted with `storage.setSessionHistory` / append (capped in storage). |

### Platform detection (`platform/platform-detector.js`, `selectors.js`)

- Hostnames in **`LLM_PLATFORMS`**: `claude.ai`, `chatgpt.com`, `chat.openai.com`, `gemini.google.com` (also subdomains via `endsWith('.${h}')`).
- **Session monitor** and **session UI** depend on matching **CSS selectors** per platform in `selectors.js`.

### Remediation (`src/content/remediation/`)

- **`remediation-modes.js`**: e.g. surgical vs other modes (stored in settings).
- **DOM** / **clipboard** / **session** remediators + **field-highlighter** integrate with pipeline output and user settings (see Options).

---

## Source of truth: `ENGINE` and message types

**`ENGINE`** (`src/shared/constants.js`): `DOM`, `CLIPBOARD`, `SESSION`, `COPY`, `SCAN`, `IMAGE`.

**Content script (`src/content/index.js`)**

- **`attachEarlyMessageBridge()`** registers `chrome.runtime.onMessage` **synchronously** (before async `main`) so scans work immediately.
- Handles: `SHOW_THREAT`, `SCAN_SELECTION`, `SCAN_KEYBOARD`, `SENTIENTCY_PING`.

**Service worker (`src/background/service-worker.js`)**

- **`sendToTab(tabId, message)`** — `tabs.sendMessage` with **one retry** after **450ms** if the receiving end is not ready.
- Context menu → `SCAN_SELECTION` with `text`.
- Command `scan-selection` → `SCAN_KEYBOARD` (content script reads `window.getSelection()`).
- `THREAT_DETECTED` → badge count + color by severity.
- `CLEAR_THREATS`, `GET_TAB_ID`, `OPEN_SIDE_PANEL`.
- `tabs.onRemoved` → clear session storage for tab, drop badge map entry.

**Custom window events** (content page): `sentientcy-threat-detected`, `sentientcy-clipboard-risk`, `sentientcy-scan-busy`, `sentientcy-scan-idle`, `sentientcy-session-health-changed`.

---

## Storage schema (`src/shared/storage.js`)

| Key | Purpose |
|-----|---------|
| `geminiApiKey` | User API key |
| `remediationMode` | Normalized remediation mode |
| `threatLog` | Array of threat objects (newest first, max **100**) |
| `session_<tabId>` | Conversation turns for trajectory (capped, see `appendSessionTurn` / `setSessionHistory`) |
| `settings` | Merged with defaults: `remediationMode`, `confidenceThreshold` (default **0.65**), nested `engines`: `{ dom, clipboard, session, copy }` all default **true** |

---

## UI surfaces

| Surface | Entry | Notes |
|---------|--------|--------|
| **Side panel** | `sidepanel.html` → `Sidepanel.jsx` | Threat log, settings shortcuts, **Scan image** file upload (size cap in UI, e.g. 4MB), opens via extension action / messages |
| **Options** | `options.html` → `Options.jsx` | API key, thresholds, engine toggles, remediation mode |
| **In-page (content)** | Shadow-mounted `App` | `SessionHealthBar` on LLM sites, `ScanningStrip`, `ThreatPanel`, `RiskModal` |
| **Extension action** | `manifest` `action` | `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` |

There is **no** `popup.html` in the manifest; primary chrome is **side panel** + **options**.

---

## Permissions and host access (`manifest.json`)

- **permissions**: `activeTab`, `scripting`, `storage`, `clipboardRead`, `clipboardWrite`, `sidePanel`, `tabs`, `alarms`, `contextMenus`
- **host_permissions**: `<all_urls>`, `https://generativelanguage.googleapis.com/*`
- **content_scripts**: `content.js`, `matches: <all_urls>`, `run_at: document_idle`, `all_frames: false`
- **web_accessible_resources**: `content.css`, `icons/*`

---

## Build and development

```bash
npm install
npm run build    # production bundle → dist/
npm run dev      # webpack --watch
```

Load **`dist/`** as an **unpacked** extension in Chrome. After code changes, **reload the extension** and **refresh tabs** so the content script updates.

**Keyboard shortcut**: `commands.scan-selection` suggests **Ctrl+Shift+S** / **Command+Shift+S**; if it does nothing, assign it under **`chrome://extensions/shortcuts`**.

---

## Repository layout (actual)

```
sentiency-cusor/
├── manifest.json              # MV3 manifest (points at dist filenames)
├── package.json
├── webpack.config.js
├── tailwind.config.js
├── postcss.config.js
├── plan.md                    # Original build spec (may diverge slightly from code)
├── public/                    # Copied to dist (e.g. icons)
├── src/
│   ├── background/service-worker.js
│   ├── classifier/
│   │   ├── gemini-client.js
│   │   └── prompts/          # single-turn, trajectory, image
│   ├── content/
│   │   ├── index.js          # early message bridge + React app + engine init
│   │   ├── engines/          # dom-scanner, clipboard-interceptor, copy-interceptor, session-monitor, input-resolve
│   │   ├── detectors/        # (re-export path: ../../detectors from content)
│   │   ├── remediation/
│   │   ├── ui/               # shadow-host, components, panel.css
│   │   └── clipboard-context.js
│   ├── detectors/          # visibility, unicode, instruction-pattern, encoding, obfuscation, injection-block-spans
│   ├── pipeline/           # threat-pipeline, taxonomy-mapper, severity-scorer
│   ├── platform/           # platform-detector, selectors
│   ├── options/
│   ├── sidepanel/
│   └── shared/             # constants, taxonomy, storage, extension-context, span-utils, removal-spans, engine-labels, LogoMark
└── dist/                   # generated; not committed in many workflows
```

**Note:** `src/content/engines/` imports detectors from **`src/detectors/`** (sibling of `content`, not under `content/detectors/`).

---

## Important implementation details for agents

1. **Message ordering**: Never register `chrome.runtime.onMessage` only after long `await` in the content script if background can message immediately — use the **early bridge** pattern in `index.js`.
2. **Gemini JSON**: Model is instructed to return raw JSON; client still strips **markdown fences** if present.
3. **Multimodal parts**: Use **`inlineData` + `mimeType`** in JSON (not snake_case) for the Generative Language REST API.
4. **Restricted pages**: Content scripts do **not** run on `chrome://` or Web Store; scans from context menu / shortcuts will not apply there.
5. **Unused deps**: **`pdfjs-dist`** / **`tesseract.js`** are not wired — add imports and webpack config if PDF/OCR is required.

---

## Version

`package.json` / `manifest.json`: **1.0.0** / name **Sentiency**.
