import fs from 'node:fs';

const path = 'artifacts/api-server/src/routes/stagewire.ts';
let source = fs.readFileSync(path, 'utf8');

if (
  source.includes('import { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";') &&
  source.includes('if (currentWorkerPrincipal().kind !== "preview") return;') &&
  source.includes('ownerKey: currentWorkerOwnerKey(),\n          venue: input.venue.trim(),')
) {
  console.log('StageWire request ownership is already finalized.');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Request ownership refactor could not find: ${label}`);
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Request ownership refactor found multiple matches for: ${label}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  'import { PREVIEW_OWNER_KEY, ownedCallWhere, ownedCallsWhere, ownedProfileWhere } from "../domain/worker-owner";\n',
  'import { PREVIEW_OWNER_KEY, ownedCallWhere, ownedCallsWhere, ownedProfileWhere } from "../domain/worker-owner";\nimport { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";\n',
  'worker context import',
);
replaceOnce(
  'async function ensureSeedData() {\n  if (seeded) return;',
  'async function ensureSeedData() {\n  if (currentWorkerPrincipal().kind !== "preview") return;\n  if (seeded) return;',
  'preview-only seed guard',
);
replaceOnce(
  'ownerKey: PREVIEW_OWNER_KEY,\n          venue: input.venue.trim(),',
  'ownerKey: currentWorkerOwnerKey(),\n          venue: input.venue.trim(),',
  'new call request owner',
);

fs.writeFileSync(path, source);
console.log('StageWire request ownership refactor complete.');
