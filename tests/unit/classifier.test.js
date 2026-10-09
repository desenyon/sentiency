import { beforeEach, it, expect, vi } from 'vitest';
import { executeGeminiRequest, REQUEST_DEADLINE_MS } from '../../src/classifier/gemini-client';
import { storage } from '../../src/shared/storage';
import { CLASSIFIER_RESPONSE_JSON_SCHEMA, IMAGE_OCR_RESPONSE_JSON_SCHEMA } from '../../src/classifier/gemini-schemas';
import { validateClassifier, validateTrajectory } from '../../src/classifier/validate-response';
const valid = () => ({ injection_detected: false, confidence: 0.1, attack_class: '', technique: '', injection_spans: [], intent: '', reasoning: 'Synthetic result' });
const envelope = (value, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] });
const options = { sourceText: 'synthetic text', generationConfig: { responseJsonSchema: CLASSIFIER_RESPONSE_JSON_SCHEMA } };
beforeEach(() => {
  vi.spyOn(storage, 'getSettings').mockResolvedValue({ remoteAnalysisEnabled: true });
  vi.spyOn(storage, 'getApiKey').mockResolvedValue('SYNTHETIC_KEY_NOT_VALID');
});
it.each([null, {}, [], 'text', { ...valid(), confidence: 1.01 }, { ...valid(), confidence: '0.9' }, { ...valid(), injection_detected: 'false' }, { ...valid(), injection_spans: [{ start: 0, end: 100, text: 'x' }] }, { ...valid(), injection_spans: [{ start: 0, end: 4, text: 'wrong' }] }])('rejects invalid model shapes/spans: %j', (value) => {
  expect(validateClassifier(value, CLASSIFIER_RESPONSE_JSON_SCHEMA, 'synthetic text')).toBe(false);
});
it('accepts exact UTF-16 spans and rejects inconsistent OCR blocks', () => {
  expect(validateClassifier({ ...valid(), injection_spans: [{ start: 0, end: 2, text: '😀' }] }, CLASSIFIER_RESPONSE_JSON_SCHEMA, '😀 test')).toBe(true);
  const ocr = { extracted_visible_text: 'one\ntwo', transcription_blocks: [{ readingOrder: 1, text: 'two' }, { readingOrder: 0, text: 'one' }], image_has_readable_text: true, suspected_visual_prompt_injection: false };
  expect(validateClassifier(ocr, IMAGE_OCR_RESPONSE_JSON_SCHEMA)).toBe(true);
  expect(validateClassifier({ ...ocr, extracted_visible_text: 'different' }, IMAGE_OCR_RESPONSE_JSON_SCHEMA)).toBe(false);
});
it('does not call the network when remote transmission is off or the key is missing', async () => {
  storage.getSettings.mockResolvedValueOnce({ remoteAnalysisEnabled: false });
  expect((await executeGeminiRequest([{ text: 'fixture' }], options)).code).toBe('remote_disabled');
  storage.getApiKey.mockResolvedValueOnce(null);
  expect((await executeGeminiRequest([{ text: 'fixture' }], options)).code).toBe('missing_key');
  expect(fetch).not.toHaveBeenCalled();
});
it('uses a header for authentication and returns only validated results', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => envelope(valid()) });
  expect((await executeGeminiRequest([{ text: 'fixture' }], options)).status).toBe('complete');
  const [url, request] = fetch.mock.calls[0]; expect(url).not.toContain('SYNTHETIC_KEY');
  expect(request.headers['x-goog-api-key']).toBe('SYNTHETIC_KEY_NOT_VALID');
});
it.each(['SAFETY', 'MAX_TOKENS', undefined])('reports incomplete/refused response as unavailable (%s)', async (reason) => {
  const result = envelope(valid()); result.candidates[0].finishReason = reason;
  fetch.mockResolvedValue({ ok: true, json: async () => result });
  expect((await executeGeminiRequest([{ text: 'fixture' }], options)).code).toBe('incomplete_response');
});
it('does not expose provider error text or retry authentication errors', async () => {
  fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'PRIVATE_PROVIDER_TEXT' } }) });
  const result = await executeGeminiRequest([{ text: 'fixture' }], options);
  expect(result.code).toBe('http_401'); expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER_TEXT'); expect(fetch).toHaveBeenCalledTimes(1);
});
it('bounds retries for transient HTTP failures', async () => {
  fetch.mockResolvedValue({ ok: false, status: 503 });
  expect((await executeGeminiRequest([{ text: 'fixture' }], options)).code).toBe('http_503'); expect(fetch).toHaveBeenCalledTimes(2);
});
it('bounds both hung fetch and hung response bodies with the total deadline', async () => {
  vi.useFakeTimers();
  for (const response of [new Promise(() => {}), Promise.resolve({ ok: true, json: () => new Promise(() => {}) })]) {
    fetch.mockReturnValueOnce(response);
    const task = executeGeminiRequest([{ text: 'fixture' }], options);
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS);
    expect((await task).code).toBe('timeout');
  }
});
it('rejects invalid JSON without retaining the raw response', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'PRIVATE invalid JSON' }] } }] }) });
  const result = await executeGeminiRequest([{ text: 'fixture' }], options);
  expect(result.code).toBe('invalid_json'); expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
it('validates trajectory bounds including a zero safe cutoff', () => {
  const value = { trajectory_attack_detected: true, confidence: 0.9, compromised_turns: [1, 12], attack_began_at_turn: 1, safe_truncation_point: 0 };
  expect(validateTrajectory(value, 12)).toBe(true);
  expect(validateTrajectory({ ...value, compromised_turns: [13] }, 12)).toBe(false);
  expect(validateTrajectory({ ...value, safe_truncation_point: -1 }, 12)).toBe(false);
});
