import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

let context;
let worker;
let profile;
let extensionId;
const fixture = '<!doctype html><html><body><h1>Synthetic extension fixture</h1><textarea id="editor"></textarea><input id="credential" type="password"><input id="otp" autocomplete="one-time-code"><div id="rich" contenteditable="true">initial rich text</div><p id="ordinary">Synthetic page selection</p></body></html>';

test.beforeAll(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'sentiency-browser-'));
  const extension = path.resolve('dist');
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--disable-background-networking'],
  });
  await context.route('**/*', (route) => {
    if (route.request().url().startsWith('http://sentiency.test/')) return route.fulfill({ contentType: 'text/html', body: fixture });
    if (route.request().url().startsWith('chrome-extension://')) return route.continue();
    return route.abort();
  });
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extensionId = worker.url().split('/')[2];
  // Every worker fetch is replaced before enabling analysis. No live key or Gemini request is used.
  await worker.evaluate(() => {
    self.syntheticRequests = [];
    self.syntheticMode = 'clean';
    self.fetch = async (url, request) => {
      if (!url.startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Network forbidden');
      self.syntheticRequests.push(JSON.parse(request.body));
      if (self.syntheticMode === 'delayed') await new Promise((resolve) => { self.releaseSynthetic = resolve; });
      const bad = self.syntheticMode === 'threat';
      const value = { injection_detected: bad, confidence: bad ? 0.99 : 0.1, attack_class: bad ? '<img src=x onerror="window.MODEL_XSS=1">' : '', technique: '', injection_spans: [], intent: '', reasoning: 'Synthetic classifier response' };
      return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: self.syntheticMode === 'invalid' ? '{}' : JSON.stringify(value) }] } }] }) };
    };
  });
});
test.afterAll(async () => { await context?.close(); if (profile) await fs.rm(profile, { recursive: true, force: true }); });
test.beforeEach(async () => {
  await worker.evaluate(async () => {
    self.syntheticRequests = []; self.syntheticMode = 'clean';
    await chrome.storage.local.set({ geminiApiKey: 'SYNTHETIC_KEY_NOT_VALID', settings: { remoteAnalysisEnabled: true }, engines: { clipboard: true, dom: false, copy: false, session: false }, remediationMode: 'SURGICAL', threatLog: [] });
  });
});
async function pageFixture() {
  const page = await context.newPage(); await page.goto('http://sentiency.test/fixture');
  await expect(page.locator('#sentientcy-host')).toBeAttached();
  // Wait for settings hydration without assuming a fixed delay: ping + poll a harmless paste.
  await expect.poll(async () => page.evaluate(() => {
    const field = document.querySelector('#editor'); field.focus();
    const data = new DataTransfer(); data.setData('text/plain', 'hydration fixture');
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    field.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
  await expect(page.locator('#editor')).toHaveValue('hydration fixture');
  await page.locator('#editor').fill('');
  await worker.evaluate(() => { self.syntheticRequests = []; });
  return page;
}
async function paste(page, selector, text, pair = false) {
  return page.evaluate(({ selector, text, pair }) => {
    const target = document.querySelector(selector); target.focus();
    const data = new DataTransfer(); data.setData('text/plain', text);
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    if (pair) target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: text }));
    return event.defaultPrevented;
  }, { selector, text, pair });
}
test('MV3 extension synchronously intercepts once and inserts through the real worker', async () => {
  const page = await pageFixture();
  expect(await paste(page, '#editor', 'a benign synthetic paste', true)).toBe(true);
  await expect(page.locator('#editor')).toHaveValue('a benign synthetic paste');
  expect(await worker.evaluate(() => self.syntheticRequests.length)).toBe(1);
  await page.close();
});
test('password and OTP fields never send a request or trigger page threat events', async () => {
  const page = await pageFixture();
  await page.evaluate(() => { window.leakedEvents = []; for (const name of ['sentientcy-threat-detected', 'sentientcy-clipboard-risk', 'sentientcy-clipboard-remediated']) window.addEventListener(name, (event) => window.leakedEvents.push(event.detail)); });
  for (const selector of ['#credential', '#otp']) expect(await paste(page, selector, 'SYNTHETIC_CREDENTIAL_DO_NOT_SEND')).toBe(false);
  expect(await worker.evaluate(() => self.syntheticRequests.length)).toBe(0);
  expect(await page.evaluate(() => window.leakedEvents)).toEqual([]);
  await page.close();
});
test('full sanitization stays empty, model HTML is inert, and history is metadata-only', async () => {
  const page = await pageFixture(); await worker.evaluate(() => { self.syntheticMode = 'threat'; });
  await page.evaluate(() => { window.leakedEvents = []; window.addEventListener('sentientcy-threat-detected', (event) => window.leakedEvents.push(event.detail)); });
  expect(await paste(page, '#editor', 'SYNTHETIC_FLAGGED_PAYLOAD')).toBe(true);
  await expect(page.locator('#sentientcy-float-warn')).toContainText('Flagged spans removed');
  await expect(page.locator('#editor')).toHaveValue('');
  expect(await page.evaluate(() => window.MODEL_XSS)).toBeUndefined();
  expect(await page.evaluate(() => window.leakedEvents)).toEqual([]);
  await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get('threatLog')).threatLog.length)).toBe(1);
  const log = await worker.evaluate(async () => (await chrome.storage.local.get('threatLog')).threatLog);
  expect(JSON.stringify(log)).not.toContain('SYNTHETIC_FLAGGED_PAYLOAD'); expect(JSON.stringify(log)).not.toContain('<img');
  await page.screenshot({ path: 'test-results/extension-smoke.png' });
  await page.close();
});
test('delayed classifier cannot overwrite a later edit', async () => {
  const page = await pageFixture(); await worker.evaluate(() => { self.syntheticMode = 'delayed'; });
  await paste(page, '#editor', 'pending synthetic paste');
  await expect.poll(async () => worker.evaluate(() => !!self.releaseSynthetic)).toBe(true);
  await page.locator('#editor').fill('newer user edit');
  await worker.evaluate(() => { self.releaseSynthetic(); delete self.releaseSynthetic; });
  await expect(page.locator('#editor')).toHaveValue('newer user edit');
  await page.close();
});
test('invalid model results produce an unavailable notice and keep paste paused', async () => {
  const page = await pageFixture(); await worker.evaluate(() => { self.syntheticMode = 'invalid'; });
  await paste(page, '#editor', 'pending synthetic paste');
  await expect(page.locator('#sentientcy-float-warn')).toContainText('Analysis unavailable');
  await expect(page.locator('#editor')).toHaveValue(''); await page.close();
});
test('options and sidepanel load and opt-out prevents Gemini transport', async () => {
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByText('Allow remote analysis.', { exact: false })).toBeVisible();
  await options.getByRole('checkbox').first().uncheck(); await options.getByRole('button', { name: 'Save settings' }).click();
  await expect(options.getByText('Saved.', { exact: true })).toBeVisible();
  const page = await context.newPage(); await page.goto('http://sentiency.test/fixture'); await expect(page.locator('#sentientcy-host')).toBeAttached();
  await expect.poll(async () => paste(page, '#editor', 'opt out synthetic')).toBe(true);
  await expect(page.locator('#sentientcy-float-warn')).toContainText('Analysis unavailable');
  expect(await worker.evaluate(() => self.syntheticRequests.length)).toBe(0);
  const panel = await context.newPage(); await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.locator('body')).toContainText('Sentiency');
  await options.close(); await page.close(); await panel.close();
});


test('real worker serializes concurrent storage writes and clears through the same queue', async () => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/options.html`);
  const result = await page.evaluate(async () => {
    const write = (operation, payload) => chrome.runtime.sendMessage({ type: 'STORAGE_MUTATE', operation, payload });
    const replies = await Promise.all(Array.from({ length: 110 }, (_, i) => write('logThreat', { threat: { id: `synthetic-${i}`, originalText: 'SYNTHETIC_PRIVATE_LOG', reasoning: 'SYNTHETIC_PRIVATE_LOG' } })));
    const before = (await chrome.storage.local.get('threatLog')).threatLog;
    await Promise.all([write('setSettings', { settings: { engines: { copy: true } } }), write('setSettings', { settings: { engines: { session: true } } })]);
    const engines = (await chrome.storage.local.get('engines')).engines;
    await write('clearThreats');
    const after = (await chrome.storage.local.get('threatLog')).threatLog;
    return { replies, before, after, engines };
  });
  expect(result.replies.every((reply) => reply.ok)).toBe(true);
  expect(result.before).toHaveLength(100); expect(new Set(result.before.map((t) => t.id)).size).toBe(100);
  expect(JSON.stringify(result.before)).not.toContain('SYNTHETIC_PRIVATE_LOG'); expect(result.after).toEqual([]);
  expect(result.engines).toMatchObject({ copy: true, session: true });
  await page.close();
});
