/**
 * Generates presentations/hackathon/Sentiency-Hackathon-Judges.pptx (14 slides)
 * Run: npm run deck:pptx
 */
import PptxGenJS from 'pptxgenjs';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'presentations', 'hackathon');
const media = join(outDir, 'media');
const outFile = join(outDir, 'Sentiency-Hackathon-Judges.pptx');

function pickShot(primary, fallback) {
  if (existsSync(primary)) return primary;
  if (existsSync(fallback)) return fallback;
  return null;
}

const shotActivity = pickShot(join(media, 'ui-activity.png'), join(media, 'screenshot-activity.png'));
const shotThreat = pickShot(join(media, 'ui-threat-detail.png'), join(media, 'screenshot-threat-detail.png'));

const proc = (n) => {
  const p = join(media, `process-0${n}.png`);
  return existsSync(p) ? p : null;
};

const BG = '09090B';
const MUTED = 'A1A1AA';
const WHITE = 'FFFFFF';
const ACCENT = '22D3EE';
const ACCENT2 = '34D399';

function accentBar(slide, yIn) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.45,
    y: yIn,
    w: 0.06,
    h: 0.55,
    fill: { color: ACCENT },
    line: { color: ACCENT, width: 0 },
  });
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Sentiency';
pptx.title = 'Sentiency — Hackathon Judges Deck';
pptx.subject = 'Real-time prompt injection defense — browser-native';

function darkSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  return slide;
}

/* 1 Title */
{
  const s = darkSlide();
  s.addText('Sentiency', { x: 0.55, y: 1.2, w: 9, h: 0.95, fontSize: 52, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText('Real-time prompt injection defense', {
    x: 0.55,
    y: 2.05,
    w: 9,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: MUTED,
    fontFace: 'Arial',
  });
  s.addText('Browser-native protection before adversarial inputs reach the model', {
    x: 0.55,
    y: 2.55,
    w: 9,
    h: 0.55,
    fontSize: 16,
    color: MUTED,
    fontFace: 'Arial',
  });
  s.addText('No backend server  •  No telemetry  •  Chrome extension  •  Local-first', {
    x: 0.55,
    y: 3.35,
    w: 9,
    h: 0.45,
    fontSize: 13,
    color: ACCENT,
    fontFace: 'Arial',
  });
  s.addText('01 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  s.addText('Group 10', {
    x: 6.85,
    y: 4.72,
    w: 3.2,
    h: 0.65,
    fontSize: 38,
    bold: true,
    color: ACCENT,
    fontFace: 'Arial',
    align: 'right',
  });
  accentBar(s, 1.28);
}

/* 2 Inspiration — photos only */
{
  const s = darkSlide();
  const ins1 = join(media, 'inspiration-1.jpg');
  const ins2 = join(media, 'inspiration-2.jpg');
  if (existsSync(ins1)) {
    s.addImage({ path: ins1, x: 0.45, y: 0.35, w: 4.45, h: 4.75, sizing: { type: 'contain', w: 4.45, h: 4.75 } });
  }
  if (existsSync(ins2)) {
    s.addImage({ path: ins2, x: 5.05, y: 0.35, w: 4.45, h: 4.75, sizing: { type: 'contain', w: 4.45, h: 4.75 } });
  }
  s.addText('02 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
}

/* 3 Problem */
{
  const s = darkSlide();
  s.addText('Context', { x: 0.55, y: 0.5, w: 9, h: 0.4, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Why we built it', { x: 0.55, y: 0.85, w: 9, h: 0.65, fontSize: 28, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    [
      { text: 'Inspiration\n', options: { breakLine: true, color: ACCENT2, fontSize: 11, bold: true } },
      {
        text: 'Prompt-injection awareness at a Google campus hackathon — user safety, not only a model problem.\n\n',
        options: { color: MUTED, fontSize: 14 },
      },
      { text: 'Problem\n', options: { breakLine: true, color: ACCENT2, fontSize: 11, bold: true } },
      {
        text: 'Instructions hide in pages, paste, screenshots, and live sessions. Users often notice too late.\n\n',
        options: { color: MUTED, fontSize: 14 },
      },
      { text: 'Goal: protect users before malicious instructions enter model context.', options: { color: 'E4E4E7', fontSize: 14, italic: true } },
    ],
    { x: 0.55, y: 1.55, w: 8.9, h: 3.4, fontFace: 'Arial' },
  );
  s.addText('03 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.95);
}

/* 4 Six engines */
{
  const s = darkSlide();
  s.addText('Product', { x: 0.55, y: 0.45, w: 9, h: 0.4, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Six engines · one shield', { x: 0.55, y: 0.78, w: 9, h: 0.55, fontSize: 26, bold: true, color: WHITE, fontFace: 'Arial' });
  const bullets = [
    { text: 'DOM engine — hidden webpage text, risky image metadata', options: { bullet: true, color: 'E4E4E7', fontSize: 11 } },
    { text: 'Clipboard guard — paste before fields update', options: { bullet: true, color: 'E4E4E7', fontSize: 11 } },
    { text: 'Copy scanner — copied selections', options: { bullet: true, color: 'E4E4E7', fontSize: 11 } },
    { text: 'Session monitor — live LLM chats', options: { bullet: true, color: 'E4E4E7', fontSize: 11 } },
    { text: 'Image analysis — visible text in screenshots (not steganography)', options: { bullet: true, color: 'E4E4E7', fontSize: 11 } },
    { text: 'Manual scan — selected text on demand', options: { bullet: true, color: 'E4E4E7', fontSize: 11 } },
  ];
  s.addText(bullets, { x: 0.55, y: 1.35, w: 8.8, h: 2.8, fontFace: 'Arial' });
  s.addText('All paths feed one threat pipeline.', { x: 0.55, y: 4.2, w: 8.9, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Arial' });
  s.addText('04 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.88);
}

/* 5 Pipeline */
{
  const s = darkSlide();
  s.addText('Architecture', { x: 0.55, y: 0.5, w: 9, h: 0.4, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('One threat pipeline', { x: 0.55, y: 0.85, w: 9, h: 0.55, fontSize: 28, bold: true, color: WHITE, fontFace: 'Arial' });
  const steps = [
    '1. Input — DOM, clipboard, session, copy, selection, image',
    '2. Local heuristics — visibility, Unicode, encoding, patterns',
    '3. Google Generative Language API — generateContent, JSON + responseJsonSchema',
    '4. Threat confirmation — thresholds and local signals',
    '5. Taxonomy, severity, character-level injection spans',
    '6. Persist, notify UI, remediate',
  ];
  s.addText(steps.join('\n'), { x: 0.55, y: 1.45, w: 8.85, h: 2.75, fontSize: 12, color: MUTED, fontFace: 'Arial' });
  s.addText('05 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.95);
}

/* 6 Differentiation */
{
  const s = darkSlide();
  s.addText('Differentiation', { x: 0.55, y: 0.5, w: 9, h: 0.4, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Browser-native · honest privacy', { x: 0.55, y: 0.85, w: 9, h: 0.55, fontSize: 26, bold: true, color: WHITE, fontFace: 'Arial' });
  const bullets = [
    { text: 'No Sentiency backend · no telemetry · local-first chrome.storage.local', options: { bullet: true, color: 'E4E4E7', fontSize: 13 } },
    { text: 'Multi-surface — text, images, sessions, paste, DOM', options: { bullet: true, color: 'E4E4E7', fontSize: 13 } },
  ];
  s.addText(bullets, { x: 0.55, y: 1.45, w: 8.8, h: 1.1, fontFace: 'Arial' });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.55,
    y: 2.65,
    w: 8.9,
    h: 1.15,
    fill: { color: '18181B' },
    line: { color: '3F3F46', width: 1 },
    rectRadius: 0.08,
  });
  s.addText(
    'Only outbound classification: Google Gemini (Generative Language API) with the user’s API key. Local-first, not “100% local” — no Sentiency servers.',
    { x: 0.75, y: 2.78, w: 8.5, h: 1, fontSize: 12, color: MUTED, fontFace: 'Arial' },
  );
  s.addText('06 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.95);
}

/* 7 UI activity */
{
  const s = darkSlide();
  s.addText('Product', { x: 0.55, y: 0.4, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Activity and threat log', { x: 0.55, y: 0.68, w: 9, h: 0.45, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  if (shotActivity) {
    s.addImage({ path: shotActivity, x: 0.75, y: 1.15, w: 8.5, h: 3.55, sizing: { type: 'contain', w: 8.5, h: 3.55 } });
  }
  s.addText('07 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.78);
}

/* 8 UI threat */
{
  const s = darkSlide();
  s.addText('Product', { x: 0.55, y: 0.4, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Threat detail', { x: 0.55, y: 0.68, w: 9, h: 0.45, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  if (shotThreat) {
    s.addImage({ path: shotThreat, x: 0.75, y: 1.15, w: 8.5, h: 3.55, sizing: { type: 'contain', w: 8.5, h: 3.55 } });
  }
  s.addText('08 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.78);
}

/* 9 Process 1 */
{
  const s = darkSlide();
  s.addText('Process', { x: 0.55, y: 0.4, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Build and iteration — part 1', { x: 0.55, y: 0.68, w: 9, h: 0.45, fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial' });
  const p1 = proc(1);
  const p2 = proc(2);
  const p3 = proc(3);
  const w = 2.75;
  const h = 1.85;
  const y = 1.2;
  if (p1) s.addImage({ path: p1, x: 0.55, y, w, h, sizing: { type: 'cover', w, h } });
  if (p2) s.addImage({ path: p2, x: 3.45, y, w, h, sizing: { type: 'cover', w, h } });
  if (p3) s.addImage({ path: p3, x: 6.35, y, w, h, sizing: { type: 'cover', w, h } });
  s.addText('09 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.78);
}

/* 10 Process 2 */
{
  const s = darkSlide();
  s.addText('Process', { x: 0.55, y: 0.4, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Build and iteration — part 2', { x: 0.55, y: 0.68, w: 9, h: 0.45, fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial' });
  const p4 = proc(4);
  const p5 = proc(5);
  const p6 = proc(6);
  const w = 2.75;
  const h = 1.85;
  const y = 1.2;
  if (p4) s.addImage({ path: p4, x: 0.55, y, w, h, sizing: { type: 'cover', w, h } });
  if (p5) s.addImage({ path: p5, x: 3.45, y, w, h, sizing: { type: 'cover', w, h } });
  if (p6) s.addImage({ path: p6, x: 6.35, y, w, h, sizing: { type: 'cover', w, h } });
  s.addText('10 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.78);
}

/* 11 Stack + algorithms */
{
  const s = darkSlide();
  s.addText('Implementation', { x: 0.55, y: 0.35, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Stack and local algorithms', { x: 0.55, y: 0.65, w: 9, h: 0.45, fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    [
      { text: 'Stack\n', options: { breakLine: true, color: ACCENT2, fontSize: 10, bold: true } },
      {
        text: 'JavaScript, React 18, Chrome MV3, Extension APIs, Tailwind, Webpack, Babel, Shadow DOM, MutationObserver, Generative Language API, chrome.storage.local.\n\n',
        options: { color: MUTED, fontSize: 10 },
      },
      { text: 'Local detection\n', options: { breakLine: true, color: ACCENT2, fontSize: 10, bold: true } },
      {
        text: 'DOM visibility, Unicode, encoding, instruction heuristics, span merge and remediation, multimodal visible text in images.',
        options: { color: MUTED, fontSize: 10 },
      },
    ],
    { x: 0.55, y: 1.1, w: 8.9, h: 3.5, fontFace: 'Arial' },
  );
  s.addText('11 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.72);
}

/* 12 Disclosure + team */
{
  const s = darkSlide();
  s.addText('Integrity', { x: 0.55, y: 0.45, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('AI disclosure and team', { x: 0.55, y: 0.75, w: 9, h: 0.45, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    'AI-assisted development. Product calls Google Gemini for classification. Architecture is ours.\n\nNo Sentiency account — bring your own Gemini API key.\n\nTeam: Naitik Gupta · Julian Juan · Eric Hou · Ming Ying',
    { x: 0.55, y: 1.25, w: 8.85, h: 2.8, fontSize: 14, color: MUTED, fontFace: 'Arial' },
  );
  s.addText('12 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.85);
}

/* 13 Challenges */
{
  const s = darkSlide();
  s.addText('Reflection', { x: 0.55, y: 0.45, w: 9, h: 0.35, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Challenges · learned · next', { x: 0.55, y: 0.75, w: 9, h: 0.45, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    [
      { text: 'Challenges: false positives · MV3 timing · hidden text · multi-turn / image attacks\n\n', options: { color: MUTED, fontSize: 12 } },
      { text: 'Learned: systems problem · safety at the interface · layered defense\n\n', options: { color: MUTED, fontSize: 12 } },
      { text: 'Next: PDF/OCR (deps present, not wired) · explainability · enterprise controls', options: { color: MUTED, fontSize: 12 } },
    ],
    { x: 0.55, y: 1.25, w: 8.85, h: 3.2, fontFace: 'Arial' },
  );
  s.addText('13 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.85);
}

/* 14 Demo */
{
  const s = darkSlide();
  s.addText('Live', { x: 0.55, y: 0.35, w: 9, h: 0.32, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Demo — before it reaches the model', { x: 0.55, y: 0.62, w: 9, h: 0.45, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  if (shotActivity && shotThreat) {
    s.addImage({ path: shotActivity, x: 0.55, y: 1.05, w: 4.35, h: 2.5, sizing: { type: 'contain', w: 4.35, h: 2.5 } });
    s.addImage({ path: shotThreat, x: 5.05, y: 1.05, w: 4.35, h: 2.5, sizing: { type: 'contain', w: 4.35, h: 2.5 } });
  } else if (shotActivity) {
    s.addImage({ path: shotActivity, x: 0.9, y: 1.05, w: 8.2, h: 2.85, sizing: { type: 'contain', w: 8.2, h: 2.85 } });
  }
  s.addText(
    [
      { text: '• Hidden webpage text highlighted\n', options: { color: 'E4E4E7', fontSize: 12 } },
      { text: '• Suspicious paste intercepted\n', options: { color: 'E4E4E7', fontSize: 12 } },
      { text: '• Image or session threat in side panel', options: { color: 'E4E4E7', fontSize: 12 } },
    ],
    { x: 0.55, y: 3.75, w: 8.8, h: 0.75, fontFace: 'Arial' },
  );
  s.addText('Warn · Highlight · Sanitize · Block', {
    x: 0.55,
    y: 4.5,
    w: 9,
    h: 0.3,
    fontSize: 11,
    bold: true,
    color: ACCENT,
    fontFace: 'Arial',
    align: 'center',
  });
  s.addText('github.com/desenyon/sentiency — thank you', {
    x: 0.55,
    y: 4.85,
    w: 9,
    h: 0.3,
    fontSize: 11,
    color: ACCENT,
    fontFace: 'Arial',
    align: 'center',
  });
  s.addText('14 / 14', { x: 8.85, y: 5.15, w: 1.2, h: 0.25, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right' });
  accentBar(s, 0.68);
}

mkdirSync(outDir, { recursive: true });
await pptx.writeFile({ fileName: outFile });
console.log('Wrote', outFile);
