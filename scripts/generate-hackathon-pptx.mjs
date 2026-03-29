/**
 * Generates presentations/hackathon/Sentiency-Hackathon-Judges.pptx (8 slides)
 * Run: npm run deck:pptx
 */
import PptxGenJS from 'pptxgenjs';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'presentations', 'hackathon');
const outFile = join(outDir, 'Sentiency-Hackathon-Judges.pptx');
const shot = join(outDir, 'media', 'screenshot-activity.png');
const shot2 = join(outDir, 'media', 'screenshot-threat-detail.png');

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
  s.addText('Browser-native protection against hidden and adversarial AI inputs', {
    x: 0.55,
    y: 2.55,
    w: 9,
    h: 0.55,
    fontSize: 16,
    color: MUTED,
    fontFace: 'Arial',
  });
  s.addText('No backend server  •  No telemetry  •  Google Chrome extension  •  Local-first storage', {
    x: 0.55,
    y: 3.35,
    w: 9,
    h: 0.45,
    fontSize: 13,
    color: ACCENT,
    fontFace: 'Arial',
  });
  accentBar(s, 1.28);
}

/* 2 Inspiration + problem */
{
  const s = darkSlide();
  s.addText('Inspiration + problem', { x: 0.55, y: 0.5, w: 9, h: 0.45, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Why we built Sentiency', { x: 0.55, y: 0.88, w: 9, h: 0.65, fontSize: 28, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    [
      { text: 'Inspiration\n', options: { breakLine: true, color: ACCENT2, fontSize: 12, bold: true } },
      {
        text: 'Prompt-injection awareness at a Google campus hackathon venue — user safety, not only a model problem.\n\n',
        options: { color: MUTED, fontSize: 14 },
      },
      { text: 'Problem\n', options: { breakLine: true, color: ACCENT2, fontSize: 12, bold: true } },
      {
        text: 'Instructions hide in pages, paste, screenshots and diagrams, and live sessions. Users often notice too late.\n\n',
        options: { color: MUTED, fontSize: 14 },
      },
      { text: 'Goal: protect users before malicious instructions enter model context.', options: { color: 'E4E4E7', fontSize: 14, italic: true } },
    ],
    { x: 0.55, y: 1.55, w: 8.9, h: 3.5, fontFace: 'Arial' },
  );
  accentBar(s, 0.95);
}

/* 3 Six engines + optional screenshot */
{
  const s = darkSlide();
  s.addText('What Sentiency does', { x: 0.55, y: 0.45, w: 9, h: 0.45, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Six detection engines. One shield.', { x: 0.55, y: 0.82, w: 5.2, h: 0.65, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  if (existsSync(shot)) {
    s.addImage({ path: shot, x: 5.85, y: 0.55, w: 3.9, h: 2.2, sizing: { type: 'contain', w: 3.9, h: 2.2 } });
  }
  const bullets = [
    { text: 'Document Object Model Engine — visually hidden webpage text and risky image metadata', options: { bullet: true, color: 'E4E4E7', fontSize: 12 } },
    { text: 'Clipboard Guard — pasted text and images before fields update', options: { bullet: true, color: 'E4E4E7', fontSize: 12 } },
    { text: 'Copy Scanner — copied selections', options: { bullet: true, color: 'E4E4E7', fontSize: 12 } },
    { text: 'Session Monitor — live large language model chats, turn and trajectory', options: { bullet: true, color: 'E4E4E7', fontSize: 12 } },
    {
      text: 'Image analysis — multimodal; visible text in screenshots (not steganography)',
      options: { bullet: true, color: 'E4E4E7', fontSize: 12 },
    },
    { text: 'Manual scan — any selected text on demand', options: { bullet: true, color: 'E4E4E7', fontSize: 12 } },
  ];
  s.addText(bullets, { x: 0.55, y: 1.45, w: 5.1, h: 3.2, fontFace: 'Arial' });
  s.addText('Six engines feed one unified threat pipeline.', { x: 0.55, y: 4.85, w: 8.9, h: 0.4, fontSize: 12, color: MUTED, fontFace: 'Arial' });
  accentBar(s, 0.88);
}

/* 4 Pipeline */
{
  const s = darkSlide();
  s.addText('How it works', { x: 0.55, y: 0.5, w: 9, h: 0.45, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('One threat pipeline', { x: 0.55, y: 0.88, w: 9, h: 0.6, fontSize: 28, bold: true, color: WHITE, fontFace: 'Arial' });
  const steps = [
    '1. Input detection — Document Object Model, clipboard, session, copy, selection scan, image',
    '2. Local heuristics — visibility, Unicode, encoding, instruction patterns',
    '3. Google Generative Language API generateContent — JSON + responseJsonSchema',
    '4. Threat confirmation — thresholds and local signals',
    '5. Taxonomy mapping, severity scoring, injection character spans',
    '6. Persist, notify user interface, remediate',
  ];
  s.addText(steps.join('\n'), { x: 0.55, y: 1.5, w: 8.85, h: 2.65, fontSize: 13, color: MUTED, fontFace: 'Arial' });
  s.addText('Callouts: hidden text · Unicode · encoding · multi-turn · image-embedded text', {
    x: 0.55,
    y: 4.15,
    w: 8.9,
    h: 0.45,
    fontSize: 11,
    color: ACCENT2,
    fontFace: 'Arial',
  });
  accentBar(s, 0.95);
}

/* 5 Why different */
{
  const s = darkSlide();
  s.addText('Why it stands out', { x: 0.55, y: 0.5, w: 9, h: 0.45, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Browser-native · honest privacy', { x: 0.55, y: 0.88, w: 9, h: 0.6, fontSize: 28, bold: true, color: WHITE, fontFace: 'Arial' });
  const bullets = [
    { text: 'Browser-native · No backend server · No telemetry', options: { bullet: true, color: 'E4E4E7', fontSize: 14 } },
    { text: 'Local-first — chrome.storage.local', options: { bullet: true, color: 'E4E4E7', fontSize: 14 } },
    { text: 'Multi-surface — text, images, sessions, paste, Document Object Model', options: { bullet: true, color: 'E4E4E7', fontSize: 14 } },
  ];
  s.addText(bullets, { x: 0.55, y: 1.55, w: 8.8, h: 1.5, fontFace: 'Arial' });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.55,
    y: 3.05,
    w: 8.9,
    h: 1.25,
    fill: { color: '18181B' },
    line: { color: '3F3F46', width: 1 },
    rectRadius: 0.08,
  });
  s.addText(
    'Only outbound classification call: Google Gemini (Generative Language API) with the user’s own API key.\nNot “100% local” — local-first, minimal network footprint, no Sentiency servers.',
    { x: 0.75, y: 3.15, w: 8.5, h: 1.1, fontSize: 12, color: MUTED, fontFace: 'Arial' },
  );
  accentBar(s, 0.95);
}

/* 6 Stack + algorithms + disclosure + team */
{
  const s = darkSlide();
  s.addText('Implementation', { x: 0.55, y: 0.35, w: 9, h: 0.4, fontSize: 12, color: ACCENT, fontFace: 'Arial' });
  s.addText('Stack, algorithms, disclosure', { x: 0.55, y: 0.68, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    [
      { text: 'Stack: ', options: { bold: true, color: WHITE, fontSize: 10 } },
      {
        text: 'JavaScript, React 18, Chrome Manifest Version 3, Extension APIs, Tailwind CSS, Webpack, Babel, Shadow DOM, MutationObserver, Google Generative Language API, chrome.storage.local.\n\n',
        options: { color: MUTED, fontSize: 10 },
      },
      { text: 'Local algorithms: ', options: { bold: true, color: WHITE, fontSize: 10 } },
      {
        text: 'DOM aggregation, visibility heuristics, Unicode anomalies, encoding detection, instruction-pattern scan, bracket injection spans, span merge for remediation, multimodal visible-text image checks.\n\n',
        options: { color: MUTED, fontSize: 10 },
      },
      { text: 'AI disclosure: ', options: { bold: true, color: WHITE, fontSize: 10 } },
      {
        text: 'AI tools assisted development; product uses Google Gemini for classification; team owns architecture.\n\n',
        options: { color: MUTED, fontSize: 10 },
      },
      { text: 'No Sentiency account — bring your own Gemini API key.\n\n', options: { color: MUTED, fontSize: 9 } },
      {
        text: 'Team: Naitik Gupta · Julian Juan · Eric Hou · Ming Ying',
        options: { color: 'A1A1AA', fontSize: 10, bold: true },
      },
    ],
    { x: 0.55, y: 1.2, w: 8.9, h: 3.8, fontFace: 'Arial' },
  );
  accentBar(s, 0.72);
}

/* 7 Challenges */
{
  const s = darkSlide();
  s.addText('Challenges · Learned · Next', { x: 0.55, y: 0.45, w: 9, h: 0.45, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Reflection', { x: 0.55, y: 0.82, w: 9, h: 0.45, fontSize: 24, bold: true, color: WHITE, fontFace: 'Arial' });
  s.addText(
    [
      { text: 'Challenges: false positives · extension timing · Chrome Manifest Version 3 · hidden text · multi-turn / image attacks\n\n', options: { color: MUTED, fontSize: 12 } },
      { text: 'Learned: systems problem · safety at interface · layered defense\n\n', options: { color: MUTED, fontSize: 12 } },
      {
        text: 'Next: Portable Document Format and optical character recognition (dependencies present, not wired) · explainability · enterprise controls',
        options: { color: MUTED, fontSize: 12 },
      },
    ],
    { x: 0.55, y: 1.28, w: 8.9, h: 3.2, fontFace: 'Arial' },
  );
  accentBar(s, 0.88);
}

/* 8 Demo last + image */
{
  const s = darkSlide();
  s.addText('Live demo', { x: 0.55, y: 0.4, w: 9, h: 0.4, fontSize: 13, color: ACCENT, fontFace: 'Arial' });
  s.addText('Before it reaches the model', { x: 0.55, y: 0.72, w: 9, h: 0.5, fontSize: 26, bold: true, color: WHITE, fontFace: 'Arial' });
  if (existsSync(shot) && existsSync(shot2)) {
    s.addImage({ path: shot, x: 0.55, y: 1.2, w: 4.35, h: 2.45, sizing: { type: 'contain', w: 4.35, h: 2.45 } });
    s.addImage({ path: shot2, x: 5.05, y: 1.2, w: 4.35, h: 2.45, sizing: { type: 'contain', w: 4.35, h: 2.45 } });
  } else if (existsSync(shot)) {
    s.addImage({ path: shot, x: 0.9, y: 1.15, w: 8.2, h: 3.2, sizing: { type: 'contain', w: 8.2, h: 3.2 } });
  }
  s.addText(
    [
      { text: '• Hidden webpage text highlighted\n', options: { color: 'E4E4E7', fontSize: 12 } },
      { text: '• Suspicious paste intercepted\n', options: { color: 'E4E4E7', fontSize: 12 } },
      { text: '• Image or session threat in side panel', options: { color: 'E4E4E7', fontSize: 12 } },
    ],
    { x: 0.55, y: 3.85, w: 8.8, h: 0.75, fontFace: 'Arial' },
  );
  s.addText('Warn · Highlight · Sanitize · Block', {
    x: 0.55,
    y: 4.65,
    w: 9,
    h: 0.32,
    fontSize: 11,
    bold: true,
    color: ACCENT,
    fontFace: 'Arial',
    align: 'center',
  });
  s.addText('Thank you — github.com/desenyon/sentiency', {
    x: 0.55,
    y: 5.05,
    w: 9,
    h: 0.32,
    fontSize: 11,
    color: ACCENT,
    fontFace: 'Arial',
    align: 'center',
  });
  accentBar(s, 0.78);
}

mkdirSync(outDir, { recursive: true });
await pptx.writeFile({ fileName: outFile });
console.log('Wrote', outFile);
