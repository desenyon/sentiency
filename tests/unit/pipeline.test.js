import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('../../src/classifier/gemini-client', () => ({ callGemini: vi.fn(), callGeminiWithImage: vi.fn(), GEMINI_CLASSIFIER_GENERATION: {}, GEMINI_IMAGE_COMBINED_GENERATION: {}, GEMINI_IMAGE_TRANSCRIBE_GENERATION: {}, GEMINI_THINKING_HIGH: {} }));
import { callGemini, callGeminiWithImage } from '../../src/classifier/gemini-client';
import { analyzeText, analyzeTextResult, analyzeTrajectory, analyzeImage, persistAndBroadcastThreat } from '../../src/pipeline/threat-pipeline';
import { storage } from '../../src/shared/storage';
import { contentEvents } from '../../src/content/events';
beforeEach(() => {
  vi.spyOn(storage, 'getSettings').mockResolvedValue({ confidenceThreshold: 0.65 });
  vi.spyOn(storage, 'logThreat').mockResolvedValue();
  callGemini.mockReset(); callGeminiWithImage.mockReset();
});
it('maps twelve-turn local indices back to a longer original conversation', async () => {
  callGemini.mockResolvedValue({ trajectory_attack_detected: true, confidence: 0.9, compromised_turns: [1, 12], attack_began_at_turn: 2, safe_truncation_point: 0 });
  const turns = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `fixture ${i + 1}` }));
  const result = await analyzeTrajectory(turns);
  expect(result).toMatchObject({ windowStart: 9, compromised_turns: [9, 20], attack_began_at_turn: 10, safe_truncation_point: 8 });
  expect(callGemini.mock.calls[0][0]).toContain('Turn 1 [user]: fixture 9');
});
it('preserves unknown cutoffs instead of inventing a safe point', async () => {
  callGemini.mockResolvedValue({ trajectory_attack_detected: false, confidence: 0.2, compromised_turns: [], safe_truncation_point: null });
  expect((await analyzeTrajectory([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }])).safe_truncation_point).toBeNull();
});
it('distinguishes unavailable from no threat detected through the structured adapter', async () => {
  callGemini.mockResolvedValueOnce({ networkError: true, code: 'timeout' });
  expect(await analyzeTextResult('synthetic benign sentence', 'CLIPBOARD')).toMatchObject({ status: 'unavailable', code: 'timeout' });
  callGemini.mockResolvedValueOnce({ injection_detected: false, confidence: 0.2, injection_spans: [] });
  expect(await analyzeTextResult('synthetic benign sentence', 'CLIPBOARD')).toMatchObject({ status: 'no_threat_detected' });
});
it('rejects stale sources before classification and oversized inputs before dispatch', async () => {
  await expect(analyzeText('fixture text', 'CLIPBOARD', { isCurrent: () => false })).rejects.toThrow('stale');
  await expect(analyzeText('x'.repeat(50001), 'CLIPBOARD')).rejects.toThrow('input_limit');
  expect(callGemini).not.toHaveBeenCalled();
});
it('does not publish raw text through window events/runtime notifications', async () => {
  const pageEvent = vi.fn(); window.addEventListener('sentientcy-threat-detected', pageEvent);
  const privateEvent = vi.fn(); contentEvents.addEventListener('sentientcy-threat-detected', privateEvent);
  await persistAndBroadcastThreat({ id: 'test', originalText: 'PRIVATE_FIXTURE', reasoning: 'PRIVATE_FIXTURE' }, true);
  expect(pageEvent).not.toHaveBeenCalled(); expect(privateEvent).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(chrome.runtime.sendMessage.mock.calls)).not.toContain('PRIVATE_FIXTURE');
  window.removeEventListener('sentientcy-threat-detected', pageEvent); contentEvents.removeEventListener('sentientcy-threat-detected', privateEvent);
});
it('image unavailability cannot become a clean image result', async () => {
  callGeminiWithImage.mockResolvedValue({ networkError: true, code: 'invalid_schema', message: 'Analysis unavailable' });
  await expect(analyzeImage('image/png', 'SYNTHETIC')).rejects.toThrow('unavailable');
});
