import fs from 'node:fs';

const path = 'artifacts/api-server/src/routes/stagewire.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Owner scoping refactor could not find: ${label}`);
  if (source.indexOf(search, first + search.length) !== -1) throw new Error(`Owner scoping refactor found multiple matches for one-time replacement: ${label}`);
  source = source.replace(search, replacement);
}

function replaceAll(search, replacement, label, minimum = 1) {
  const count = source.split(search).length - 1;
  if (count < minimum) throw new Error(`Owner scoping refactor expected at least ${minimum} match(es) for ${label}, found ${count}`);
  source = source.split(search).join(replacement);
  console.log(`${label}: ${count} replacement(s)`);
}

replaceOnce(
  'import { asc, desc, eq, sql } from "drizzle-orm";',
  'import { and, asc, desc, eq, sql } from "drizzle-orm";',
  'drizzle import',
);
replaceOnce(
  'import { db, callChecklistItems, callExpenses, callNotes, calls, workerProfiles } from "@workspace/db";\n',
  'import { db, callChecklistItems, callExpenses, callNotes, calls, workerProfiles } from "@workspace/db";\nimport { PREVIEW_OWNER_KEY, ownedCallWhere, ownedCallsWhere, ownedProfileWhere } from "../domain/worker-owner";\n',
  'worker ownership import',
);
replaceAll(
  '.from(calls).where(eq(calls.id, id)).limit(1)',
  '.from(calls).where(ownedCallWhere(id)).limit(1)',
  'owned call reads',
  2,
);
replaceOnce(
  'const existingProfile = await db.select({ id: workerProfiles.id }).from(workerProfiles).limit(1);',
  'const existingProfile = await db.select({ id: workerProfiles.id }).from(workerProfiles).where(ownedProfileWhere()).limit(1);',
  'seed profile lookup',
);
replaceOnce(
  '    await db.insert(workerProfiles).values({\n      displayName: "StageWire Worker",',
  '    await db.insert(workerProfiles).values({\n      ownerKey: PREVIEW_OWNER_KEY,\n      displayName: "StageWire Worker",',
  'seed profile owner',
);
replaceOnce(
  'const existingCall = await db.select({ id: calls.id }).from(calls).limit(1);',
  'const existingCall = await db.select({ id: calls.id }).from(calls).where(ownedCallsWhere()).limit(1);',
  'seed call lookup',
);
replaceOnce(
  '      {\n        venue: "Demo Arena",',
  '      {\n        ownerKey: PREVIEW_OWNER_KEY,\n        venue: "Demo Arena",',
  'first seed call owner',
);
replaceOnce(
  '      {\n        venue: "Downtown Theatre",',
  '      {\n        ownerKey: PREVIEW_OWNER_KEY,\n        venue: "Downtown Theatre",',
  'second seed call owner',
);
replaceOnce(
  'const rows = await db.select().from(calls);',
  'const rows = await db.select().from(calls).where(ownedCallsWhere());',
  'dashboard call scope',
);
replaceAll(
  '.from(workerProfiles).orderBy(asc(workerProfiles.id)).limit(1)',
  '.from(workerProfiles).where(ownedProfileWhere()).orderBy(asc(workerProfiles.id)).limit(1)',
  'profile reads',
  4,
);
replaceOnce(
  '.where(eq(workerProfiles.id, current.id))',
  '.where(and(eq(workerProfiles.id, current.id), ownedProfileWhere()))',
  'profile update scope',
);
replaceOnce(
  'const rows = await db.select().from(calls).orderBy(desc(calls.workDate), desc(calls.id));',
  'const rows = await db.select().from(calls).where(ownedCallsWhere()).orderBy(desc(calls.workDate), desc(calls.id));',
  'calls list scope',
);
replaceOnce(
  '        .values({\n          venue: input.venue.trim(),',
  '        .values({\n          ownerKey: PREVIEW_OWNER_KEY,\n          venue: input.venue.trim(),',
  'new call owner',
);
replaceAll(
  '.where(eq(calls.id, id))',
  '.where(ownedCallWhere(id))',
  'owned call updates',
  3,
);
replaceAll(
  '.where(eq(calls.status, "finished"))',
  '.where(and(ownedCallsWhere(), eq(calls.status, "finished")))',
  'finished-call read scope',
  2,
);

fs.writeFileSync(path, source);
console.log('StageWire preview-worker ownership scoping complete.');
