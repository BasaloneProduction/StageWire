import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rootPackage = fs.readFileSync(new URL("../../../../package.json", import.meta.url), "utf8");
const dbPackage = fs.readFileSync(new URL("../../../../lib/db/package.json", import.meta.url), "utf8");
const replit = fs.readFileSync(new URL("../../../../.replit", import.meta.url), "utf8");
const postMerge = fs.readFileSync(new URL("../../../../scripts/post-merge.sh", import.meta.url), "utf8");

test("deployment keeps a concrete database schema-application path", () => {
  assert.match(rootPackage, /"db:prepare"\s*:\s*"pnpm --dir lib\/db push"/);
  assert.match(dbPackage, /"push"\s*:\s*"drizzle-kit push --config \.\/drizzle\.config\.ts"/);
  assert.match(replit, /\[postMerge\][\s\S]*path\s*=\s*"scripts\/post-merge\.sh"/);
  assert.match(postMerge, /set -euo pipefail/);
  assert.match(postMerge, /pnpm run db:prepare/);
  assert.doesNotMatch(postMerge, /pnpm\s+--filter\s+db\s+push/, "post-merge must not rely on an ambiguous package selector");
});
