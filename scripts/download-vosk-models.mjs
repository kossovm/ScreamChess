#!/usr/bin/env node
// Downloads Vosk speech models, unpacks them, and re-archives as .tar.gz
// (which is what vosk-browser expects). Saves to public/vosk-models/.
//
// Usage: node scripts/download-vosk-models.mjs [en|ru|all]

import { mkdirSync, existsSync, createWriteStream, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'vosk-models');

const MODELS = {
  en: {
    name: 'vosk-model-small-en-us-0.15',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    size: '~40 MB',
  },
  ru: {
    name: 'vosk-model-small-ru-0.22',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip',
    size: '~45 MB',
  },
};

async function downloadFile(url, dest) {
  console.log(`  ↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  const reader = res.body.getReader();
  const out = createWriteStream(dest);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out.write(value);
    if (total) {
      const pct = Math.round((received / total) * 100);
      process.stdout.write(`\r  · ${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB (${pct}%)   `);
    }
  }
  out.end();
  await new Promise((r) => out.on('close', r));
  process.stdout.write('\n');
}

async function processModel(key) {
  const def = MODELS[key];
  if (!def) throw new Error(`Unknown model: ${key}`);

  const finalPath = join(OUT_DIR, `${def.name}.tar.gz`);
  if (existsSync(finalPath)) {
    console.log(`✓ ${def.name}.tar.gz already exists, skipping (delete to redownload)`);
    return;
  }

  console.log(`\n=== ${def.name} (${def.size}) ===`);
  const tmp = join(tmpdir(), `vosk-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  const zipPath = join(tmp, 'model.zip');
  await downloadFile(def.url, zipPath);

  console.log('  · unzipping…');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tmp, true);

  // Locate the extracted folder (usually the model name)
  const entries = zip.getEntries();
  const topDir = entries[0]?.entryName.split('/')[0];
  if (!topDir) throw new Error('Could not detect top-level directory in zip');
  const extracted = join(tmp, topDir);
  if (!existsSync(extracted)) throw new Error(`Expected ${extracted} after unzip`);

  console.log('  · re-archiving as .tar.gz…');
  mkdirSync(OUT_DIR, { recursive: true });
  await tar.create(
    { gzip: true, file: finalPath, cwd: tmp },
    [topDir]
  );

  rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${finalPath}`);
}

async function main() {
  const arg = (process.argv[2] || 'all').toLowerCase();
  const keys = arg === 'all' ? Object.keys(MODELS) : [arg];

  console.log('Vosk model setup');
  console.log(`Output: ${OUT_DIR}\n`);

  for (const k of keys) {
    try {
      await processModel(k);
    } catch (e) {
      console.error(`✗ ${k} failed:`, e.message);
      process.exitCode = 1;
    }
  }
  console.log('\nDone. Restart `npm run dev` if it was running.');
}

main();
