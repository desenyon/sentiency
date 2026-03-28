/**
 * Selectors target production UIs as of early 2026.
 * Platform DOM changes may require updates in this file only.
 */
export const SELECTORS = {
  'claude.ai': {
    messageContainer: '[data-testid="conversation-turn"]',
    userMessage: '[data-testid="user-message"]',
    assistantMessage: '[data-testid="assistant-message"]',
    toolResult: '[data-testid="tool-result"]',
    inputField: 'div[contenteditable="true"][data-testid="input-textarea"], div.ProseMirror[contenteditable="true"]',
    submitButton: 'button[aria-label*="Send"], button[data-testid*="send"]',
  },
  'chatgpt.com': {
    messageContainer: '[data-testid="conversation-turn"], article[data-testid^="conversation-turn"]',
    userMessage: '[data-message-author-role="user"]',
    assistantMessage: '[data-message-author-role="assistant"]',
    toolResult: '[data-testid="tool-interaction"]',
    inputField:
      '#prompt-textarea, textarea#prompt-textarea, textarea[data-id="root"], div#prompt-textarea[contenteditable="true"], div[contenteditable="true"]#prompt-textarea, div.ProseMirror[contenteditable="true"]',
    submitButton: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
  },
  'chat.openai.com': {
    messageContainer: '[data-testid="conversation-turn"], article',
    userMessage: '[data-message-author-role="user"]',
    assistantMessage: '[data-message-author-role="assistant"]',
    toolResult: '[data-testid="tool-interaction"]',
    inputField: '#prompt-textarea, textarea[data-id="root"], div[contenteditable="true"]',
    submitButton: 'button[data-testid="send-button"]',
  },
  'gemini.google.com': {
    messageContainer: 'div.conversation-container, main',
    userMessage: 'div[data-role="user"], .user-query-bubble',
    assistantMessage: 'div[data-role="model"], message-content, model-response',
    toolResult: 'tool-output, .tool-result',
    inputField: 'div[contenteditable="true"].ql-editor, rich-textarea, div[aria-label*="message"]',
    submitButton: 'button[aria-label*="Send"], button.send-button',
  },
};
