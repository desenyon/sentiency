import { it, expect, vi } from 'vitest';
import { storage } from '../../src/shared/storage';
import { remediateDOM, undoDOMRemediation } from '../../src/content/remediation/dom-remediator';
import { snapshotSession } from '../../src/content/engines/session-monitor';
import { remediateSession } from '../../src/content/remediation/session-remediator';
it.each(['HIGHLIGHT', 'SURGICAL', 'BLOCK'])('DOM %s preserves child identity/listeners and is reversible', async (mode) => {
  vi.spyOn(storage, 'getRemediationMode').mockResolvedValue(mode);
  document.body.innerHTML = '<section style="color:blue" title="original"><b>synthetic text</b><button>keep</button></section>';
  const el = document.querySelector('section'); const child = el.querySelector('button'); const click = vi.fn(); child.addEventListener('click', click);
  expect(await remediateDOM(el, { attackClass: '<img onerror=alert(1)>' })).toBe(true);
  child.click(); expect(click).toHaveBeenCalledTimes(1); expect(el.querySelector('img')).toBeNull();
  expect(undoDOMRemediation(el)).toBe(true); expect(el.querySelector('button')).toBe(child);
  expect(el.getAttribute('style')).toBe('color:blue'); expect(el.title).toBe('original');
});
it('does not undo intervening page changes or remediate stale sources', async () => {
  vi.spyOn(storage, 'getRemediationMode').mockResolvedValue('BLOCK');
  document.body.innerHTML = '<p>fixture</p>'; const el = document.querySelector('p');
  expect(await remediateDOM(el, {}, () => false)).toBe(false);
  await remediateDOM(el, {}); el.style.color = 'red'; expect(undoDOMRemediation(el)).toBe(false);
});
it('classifies a message container that itself matches the role selector', () => {
  document.body.innerHTML = '<article data-role="user">one</article><article data-role="assistant">two</article><article data-role="user" data-private>private</article>';
  const turns = snapshotSession({ messageContainer: 'article', userMessage: '[data-role="user"]', assistantMessage: '[data-role="assistant"]' });
  expect(turns.map(({ role, content }) => ({ role, content }))).toEqual([{ role: 'user', content: 'one' }, { role: 'assistant', content: 'two' }]);
});
it('uses mapped snapshot nodes for trajectory remediation and renders descriptions literally', () => {
  document.body.innerHTML = '<article>excluded</article><article>first</article><article>second</article>';
  const nodes = [...document.querySelectorAll('article')];
  remediateSession({ compromised_turns: [2], safe_truncation_point: 0, description: '<img onerror=alert(1)>' }, 'synthetic', { messageContainer: 'article' }, nodes.slice(1));
  expect(nodes[0].style.outline).toBe(''); expect(nodes[1].style.outline).toBe(''); expect(nodes[2].style.outline).toContain('3px');
  expect(document.querySelector('#sentientcy-session-banner img')).toBeNull();
  document.querySelector('#sentientcy-session-banner button').click(); expect(nodes[2].style.outline).toBe('');
});
