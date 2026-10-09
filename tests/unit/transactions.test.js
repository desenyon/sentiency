import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPasteTransaction } from '../../src/content/remediation/paste-transaction';
import { remediateClipboard } from '../../src/content/remediation/clipboard-remediator';
import { buildSurgicalText } from '../../src/shared/removal-spans';
let transactions;
beforeEach(() => { vi.useFakeTimers(); transactions = []; });
afterEach(() => transactions.forEach((tx) => tx?.dispose()));
function capture(el) { const tx = createPasteTransaction(el); transactions.push(tx); return tx; }
function field() {
  document.body.innerHTML = '<textarea>before SELECT after</textarea>';
  const el = document.querySelector('textarea'); el.setSelectionRange(7, 13); return el;
}
it('replaces the captured selection even if focus/caret moves during analysis', () => {
  const el = field(); const tx = capture(el); el.setSelectionRange(0, 0);
  expect(tx.replace('paste')).toBe(true); expect(el.value).toBe('before paste after');
});
it('mode changes replace only the transaction and block restores the original selection', async () => {
  const el = field(); const tx = capture(el);
  const threat = { injectionSpans: [{ start: 5, end: 9 }] };
  await remediateClipboard('good EVIL', threat, el, 'SURGICAL', tx);
  expect(el.value).toBe('before good  after');
  await remediateClipboard('good EVIL', threat, el, 'HIGHLIGHT', tx);
  expect(el.value).toBe('before good EVIL after');
  await remediateClipboard('good EVIL', threat, el, 'BLOCK', tx);
  expect(el.value).toBe('before SELECT after');
  await remediateClipboard('good EVIL', threat, el, 'BLOCK', tx);
  expect(el.value).toBe('before SELECT after');
});
it.each([true, false])('never reinserts a fully removed payload (known spans: %s)', async (withSpans) => {
  const el = field(); const tx = capture(el);
  await remediateClipboard('SYNTHETIC', { injectionSpans: withSpans ? [{ start: 0, end: 9 }] : [] }, el, 'SURGICAL', tx);
  expect(el.value).toBe('before  after');
});
it('rejects later user edits, programmatic updates, detached and newly sensitive targets', () => {
  let el = field(); let tx = capture(el); el.value += '!'; expect(tx.replace('bad')).toBe(false);
  el = field(); tx = capture(el); el.dispatchEvent(new InputEvent('input')); expect(tx.undo()).toBe(false);
  el = field(); tx = capture(el); el.remove(); expect(tx.replace('bad')).toBe(false);
  el = field(); tx = capture(el); el.name = 'password'; expect(tx.replace('bad')).toBe(false);
});
it('supersedes an older pending paste and expires retained transactions', async () => {
  const el = field(); const old = capture(el); const next = capture(el);
  expect(old.replace('old')).toBe(false); expect(next.replace('new')).toBe(true);
  await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
  expect(next.undo()).toBe(false);
});
it('preserves rich editor siblings and original selected nodes across undo', () => {
  document.body.innerHTML = '<div contenteditable="true"><b>SELECT</b><i>keep</i></div>';
  const el = document.querySelector('div'); const bold = el.firstChild; const sibling = el.lastChild;
  const range = document.createRange(); range.selectNode(bold);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  const tx = capture(el); expect(tx.replace('<img onerror=alert(1)>')).toBe(true);
  expect(el.querySelector('img')).toBeNull(); expect(el.lastChild).toBe(sibling);
  expect(tx.undo()).toBe(true); expect(el.querySelector('b')).toBe(bold);
  expect(tx.replace('again')).toBe(true); expect(tx.undo()).toBe(true); expect(el.querySelector('b')).toBe(bold);
});
it('rejects rich editor DOM replacement with identical markup', () => {
  document.body.innerHTML = '<div contenteditable="true">selected</div>';
  const el = document.querySelector('div'); const range = document.createRange(); range.selectNodeContents(el);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
  const tx = capture(el); const sameMarkup = el.innerHTML; el.innerHTML = sameMarkup;
  expect(tx.replace('new')).toBe(false);
});
it('renders model strings as text, never live HTML', async () => {
  const el = field(); const tx = capture(el);
  await remediateClipboard('fixture', { attackClass: '<img src=x onerror=alert(1)>' }, el, 'BLOCK', tx);
  expect(document.querySelector('#sentientcy-float-warn img')).toBeNull();
  expect(document.querySelector('#sentientcy-float-warn').textContent).toContain('<img');
});
it('handles overlapping and out of bounds removal spans without reinserting text', () => {
  expect(buildSurgicalText('0123456789', [{ start: 2, end: 8 }, { start: 4, end: 6 }, { start: 7, end: 100 }])).toBe('01');
});
