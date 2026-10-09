import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';

const run = promisify(execFile);

test('historical presentation generator produces 14 valid slides and preserves embedded media', { timeout: 30000 }, async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sentiency-deck-'));
  const destination = path.join(temporary, 'nested/deck.pptx');
  const tracked = 'presentations/hackathon/Sentiency-Hackathon-Judges.pptx';
  const original = await fs.readFile(tracked);
  try {
    await run(process.execPath, ['scripts/generate-hackathon-pptx.mjs'], { env: { ...process.env, SENTIENCY_DECK_OUTPUT: destination } });
    const zip = await JSZip.loadAsync(await fs.readFile(destination), { checkCRC32: true });
    const slides = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
    assert.equal(slides.length, 14);
    const media = zip.file(/^ppt\/media\/.+\.(png|jpg)$/);
    assert.equal(media.length, 12);
    for (const file of media) assert.ok((await file.async('uint8array')).length > 1000, file.name);
    for (const file of zip.file(/\.(xml|rels)$/)) {
      const dom = new JSDOM(await file.async('string'), { contentType: 'text/xml' });
      if (slides.includes(file)) assert.ok(dom.window.document.getElementsByTagName('a:t').length > 0, file.name);
      if (file.name.endsWith('.rels')) {
        const owner = file.name === '_rels/.rels' ? '' : path.posix.dirname(file.name.replace('/_rels/', '/').replace(/\.rels$/, ''));
        for (const relation of dom.window.document.getElementsByTagName('Relationship')) {
          if (relation.getAttribute('TargetMode') === 'External') continue;
          const target = path.posix.normalize(path.posix.join(owner, relation.getAttribute('Target')));
          assert.ok(zip.file(target), `${file.name} has missing target ${target}`);
        }
      }
      dom.window.close();
    }
    assert.deepEqual(await fs.readFile(tracked), original, 'Smoke output must not overwrite the tracked deck');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});
