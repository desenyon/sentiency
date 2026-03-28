import { LLM_PLATFORMS } from '../shared/constants';
import { SELECTORS } from './selectors';

export function detectPlatform() {
  const host = window.location.hostname.replace(/^www\./, '');
  const match = LLM_PLATFORMS.find((h) => host === h || host.endsWith(`.${h}`));
  if (!match) {
    return { isLLMPlatform: false, platform: null, selectors: null };
  }
  const selectors = SELECTORS[match] || null;
  return { isLLMPlatform: true, platform: match, selectors };
}
