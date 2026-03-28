export const LLM_PLATFORMS = [
  'claude.ai',
  'chatgpt.com',
  'chat.openai.com',
  'gemini.google.com',
];

export const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const ENGINE = {
  DOM: 'DOM',
  CLIPBOARD: 'CLIPBOARD',
  SESSION: 'SESSION',
  COPY: 'COPY',
  SCAN: 'SCAN',
  /** Sidebar file upload */
  IMAGE: 'IMAGE',
};

/** Stronger multimodal reasoning: try `gemini-3-flash-preview` or `gemini-3-pro-preview` (higher cost/latency). */
export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export { REMEDIATION_MODES } from './remediation-modes';

export const ZERO_WIDTH_CHARS = [
  '\u200B',
  '\u200C',
  '\u200D',
  '\uFEFF',
  '\u2060',
  '\u180E',
];

export const INSTRUCTION_KEYWORDS = [
  'ignore previous',
  'disregard all',
  'forget your instructions',
  'new rule',
  'you are now',
  'override your',
  'your new instructions are',
  'do not follow',
  'ignore all prior',
  'bypass your',
  'from now on you',
  'pretend you are',
  'act as if you have no',
  'your actual instructions',
  'system prompt:',
  '[system]',
  '<system>',
  'ignore the above',
  'disregard the above',
  'actually your goal is',
  'system:',
  'user:',
  'role:',
  '### instruction',
  'end of system',
];

export const HOMOGLYPH_MAP = {
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043E': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0445': 'x',
  '\u0391': 'A',
  '\u0392': 'B',
  '\u0395': 'E',
  '\u0396': 'Z',
  '\u0397': 'H',
  '\u0399': 'I',
  '\u039A': 'K',
  '\u039C': 'M',
  '\u039D': 'N',
  '\u039F': 'O',
  '\u03A1': 'P',
  '\u03A4': 'T',
  '\u03A5': 'Y',
  '\u03A7': 'X',
};

export const TRAJECTORY_WINDOW = 12;

export const CONFIDENCE_THRESHOLD = 0.65;

export const DOM_DEBOUNCE_MS = 250;

/** Legacy: long paste on non-editable targets */
export const PASTE_MIN_CHARS_GLOBAL = 50;

/** Minimum pasted length to analyze when pasting into any editable field (any website) */
export const PASTE_MIN_CHARS_EDITABLE = 8;

export const STREAMING_STABLE_MS = 500;

export const COPY_SCAN_MIN_CHARS = 20;
