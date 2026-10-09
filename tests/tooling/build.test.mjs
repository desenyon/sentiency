import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import webpack from 'webpack';
import config from '../../webpack.config.js';

const root = process.cwd();

test('development watch recompiles source utilities and copies changed assets', { timeout: 60000 }, async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'sentiency-watch-'));
  let watcher;
  try {
    for (const file of ['src', 'public', 'manifest.json', 'postcss.config.js', 'tailwind.config.js']) {
      await fs.cp(path.join(root, file), path.join(fixture, file), { recursive: true });
    }
    await fs.symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    const output = path.join(fixture, 'dist');
    const compiler = webpack({ ...config, mode: 'development', context: fixture, output: { ...config.output, path: output } });
    await new Promise((resolve, reject) => {
      let modified = false;
      const deadline = setTimeout(() => reject(new Error('Watch did not publish both changed source CSS and asset')), 45000);
      watcher = compiler.watch({ aggregateTimeout: 100, poll: 100, ignored: /node_modules/ }, async (error, stats) => {
        try {
          if (error) throw error;
          if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
          if (!modified) {
            modified = true;
            for (const [from, to] of [['manifest.json', 'manifest.json'], ['src/options/index.html', 'options.html'], ['src/sidepanel/index.html', 'sidepanel.html'], ...['icon16.png', 'icon48.png', 'icon128.png', 'logo.png'].map((name) => [`public/icons/${name}`, `icons/${name}`])]) {
              assert.deepEqual(await fs.readFile(path.join(output, to)), await fs.readFile(path.join(root, from)), `Copied ${from}`);
            }
            await fs.appendFile(path.join(fixture, 'src/options/Options.jsx'), '\n// Synthetic watch fixture: w-[137px]\n');
            await fs.writeFile(path.join(fixture, 'public/icons/watch-fixture.txt'), 'synthetic changed asset');
          } else {
            const css = await fs.readFile(path.join(output, 'options.css'), 'utf8');
            const asset = await fs.readFile(path.join(output, 'icons/watch-fixture.txt'), 'utf8').catch(() => '');
            if (css.includes('width: 137px') && asset === 'synthetic changed asset') { clearTimeout(deadline); resolve(); }
          }
        } catch (error) { clearTimeout(deadline); reject(error); }
      });
    });
  } finally {
    if (watcher) await new Promise((resolve, reject) => watcher.close((error) => error ? reject(error) : resolve()));
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
