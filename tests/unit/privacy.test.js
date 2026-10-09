import { describe, it, expect } from 'vitest';
import { isSensitiveElement, selectionIsSensitive, threatMetadata } from '../../src/shared/privacy';
import { isEditableTarget, resolveInputRoot } from '../../src/content/engines/input-resolve';

describe('credential boundary', () => {
  it.each([
    '<input type="password">', '<input autocomplete="new-password">', '<input autocomplete="section-a one-time-code">',
    '<input autocomplete="cc-number">', '<textarea name="api_key"></textarea>', '<input aria-label="Access token">',
    '<label>Secret<input></label>', '<form><input type="password"><textarea></textarea></form>',
    '<div data-sentiency-private><div contenteditable="true">synthetic</div></div>',
  ])('excludes %s before editable resolution', (html) => {
    document.body.innerHTML = html;
    const el = document.querySelector('textarea, [contenteditable]') || document.querySelector('input');
    expect(isSensitiveElement(el)).toBe(true);
    expect(isEditableTarget(el)).toBe(false);
    expect(resolveInputRoot(el, { selectors: { inputField: '*' } })).toBeNull();
  });
  it('excludes credential forms even when the paste target is a normal sibling', () => {
    document.body.innerHTML = '<form><input type="password"><input id="ordinary"></form>';
    expect(isSensitiveElement(document.querySelector('#ordinary'))).toBe(true);
  });
  it('follows shadow hosts when checking privacy opt-outs', () => {
    const host = document.createElement('div'); host.dataset.private = ''; document.body.append(host);
    const input = document.createElement('input'); host.attachShadow({ mode: 'open' }).append(input);
    expect(isSensitiveElement(input)).toBe(true);
  });
  it('allows an ordinary textarea and excludes disabled/read-only fields', () => {
    document.body.innerHTML = '<textarea></textarea>';
    const el = document.querySelector('textarea');
    expect(isEditableTarget(el)).toBe(true);
    el.readOnly = true; expect(isEditableTarget(el)).toBe(false);
  });
  it('excludes sensitive selections before text extraction', () => {
    document.body.innerHTML = '<div data-private>synthetic secret</div>';
    const range = document.createRange(); range.selectNodeContents(document.querySelector('div'));
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    expect(selectionIsSensitive()).toBe(true);
  });
  it('allowlists durable records and strips all model prose and image data', () => {
    const result = threatMetadata({ id: 'test-id', originalText: 'PRIVATE_FIXTURE', decodedText: 'PRIVATE_FIXTURE', intent: 'PRIVATE_FIXTURE', reasoning: 'PRIVATE_FIXTURE', technique: 'PRIVATE_FIXTURE', attackClass: 'PRIVATE_FIXTURE', previewImageDataUrl: 'PRIVATE_FIXTURE', injectionSpans: [{ text: 'PRIVATE_FIXTURE' }], confidence: Infinity });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_FIXTURE');
    expect(result.metadataOnly).toBe(true);
    expect(result.confidence).toBe(0);
  });
});
