import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const manifest = JSON.parse(read('artifacts/stagewire/public/manifest.webmanifest'));
const main = read('artifacts/stagewire/src/main.tsx');
const app = read('artifacts/stagewire/src/App.tsx');
const css = read('artifacts/stagewire/src/accessibility.css');
const serviceWorker = read('artifacts/stagewire/public/stagewire-sw.js');
const finishCall = read('artifacts/stagewire/src/pages/smart-finish-call.tsx');

assert.equal(manifest.display, 'standalone', 'StageWire must remain installable in standalone mode.');
assert.ok(manifest.start_url, 'The web app manifest must define a start URL.');
assert.ok(manifest.scope, 'The web app manifest must define its navigation scope.');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'The web app manifest must include an icon.');
assert.match(main, /serviceWorker[\s\S]*register/, 'The production app must register its offline shell.');
assert.match(main, /<InstallAppNotice\s*\/>/, 'Workers must have visible phone-install guidance.');

for (const route of ['/calls', '/crew-kit', '/workday/:id', '/closeout/:id', '/receipt/:id', '/money', '/vault-v14', '/passport-v14']) {
  assert.ok(app.includes(`path="${route}"`), `Worker journey route missing: ${route}`);
}

assert.match(css, /\.btn,[\s\S]*min-height:\s*52px/, 'Standard controls must keep a 52px minimum tap target.');
assert.match(css, /@media \(max-width: 700px\)[\s\S]*min-height:\s*56px/, 'Phone controls must keep a 56px minimum tap target.');
assert.match(css, /input\[type='checkbox'\][\s\S]*min-width:\s*28px/, 'Checklist controls must remain glove-friendly.');
assert.match(serviceWorker, /isApiRequest/, 'Offline shell must explicitly recognize API requests.');
assert.match(serviceWorker, /isApiRequest\(url\)\) return/, 'Offline shell must never cache private API responses.');
assert.match(finishCall, /Receipt was not locked\./, 'Failed closeouts must clearly say the receipt was not locked.');
assert.match(finishCall, /unfinished closeout remains in this tab/, 'Failed closeouts must reassure workers that their draft remains.');

console.log('StageWire mobile readiness audit passed.');
