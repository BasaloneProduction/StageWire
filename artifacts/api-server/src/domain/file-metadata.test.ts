import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../routes/file-metadata.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");

test("file metadata is worker-owned and mounted behind worker identity", () => {
  assert.match(schema, /workerFileMetadata = pgTable\("worker_file_metadata"/);
  assert.match(schema, /ownerKey: text\("owner_key"\)\.notNull\(\)\.references\(\(\) => workerProfiles\.ownerKey/);
  assert.match(route, /currentWorkerOwnerKey\(\)/);
  assert.match(route, /eq\(workerFileMetadata\.ownerKey, ownerKey\)/);
  assert.match(routeIndex, /router\.use\(workerIdentityRouter\)[\s\S]*router\.use\(fileMetadataRouter\)/, "worker identity must be established before file metadata routes run");
});

test("file metadata API never exposes object storage keys", () => {
  assert.doesNotMatch(route, /storageKey:\s*workerFileMetadata\.storageKey/, "clients must not receive private object storage keys");
  assert.match(route, /storageStatus:\s*workerFileMetadata\.storageStatus/);
});

test("metadata-only records cannot pretend file bytes are stored", () => {
  assert.match(route, /storageKey:\s*null/);
  assert.match(route, /storageStatus:\s*"metadata"/);
  assert.match(route, /existing\.storageStatus === "stored"/);
  assert.match(route, /status\(409\)/, "stored object deletion must stay blocked until secure storage deletion is wired");
});

test("file metadata validates type, filename, and bounded size", () => {
  assert.match(route, /FILE_KINDS = new Set\(\["certification", "document", "profile-photo"\]\)/);
  assert.match(route, /name\.length <= 255/);
  assert.match(route, /MAX_METADATA_SIZE_BYTES/);
  assert.match(route, /Number\.isInteger\(sizeBytes\)/);
  assert.match(route, /status\(400\)/);
});

test("document and certification metadata saves are idempotent", () => {
  assert.match(route, /kind !== "profile-photo"/);
  assert.match(route, /eq\(workerFileMetadata\.name, name\)/);
  assert.match(route, /eq\(workerFileMetadata\.sizeBytes, sizeBytes\)/);
  assert.match(route, /eq\(workerFileMetadata\.mimeType, mimeType\)/);
  assert.match(route, /return \{ record: existing, created: false \}/);
  assert.match(route, /res\.status\(result\.created \? 201 : 200\)/, "retries must return the existing metadata record instead of duplicating it");
});

test("profile photo metadata keeps one metadata-only current choice per worker", () => {
  assert.match(route, /kind !== "profile-photo"[\s\S]*else \{/);
  assert.match(route, /eq\(workerFileMetadata\.kind, "profile-photo"\)/);
  assert.match(route, /eq\(workerFileMetadata\.storageStatus, "metadata"\)/);
  assert.match(route, /db\.transaction/);
});
