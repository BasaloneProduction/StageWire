import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../routes/file-metadata.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../../../stagewire/src/components/worker-file-metadata.tsx", import.meta.url), "utf8");

test("file metadata is worker-owned and mounted behind worker identity", () => {
  assert.match(schema, /workerFileMetadata = pgTable\("worker_file_metadata"/);
  assert.match(schema, /ownerKey: text\("owner_key"\)\.notNull\(\)\.references\(\(\) => workerProfiles\.ownerKey/);
  assert.match(route, /currentWorkerOwnerKey\(\)/);
  assert.match(route, /eq\(workerFileMetadata\.ownerKey, ownerKey\)/);
  assert.match(routeIndex, /router\.use\(workerIdentityRouter\)[\s\S]*router\.use\(fileMetadataRouter\)/, "worker identity must be established before file metadata routes run");
});

test("file API never exposes private object storage keys", () => {
  const columnsStart = route.indexOf("const fileRecordColumns = {");
  const columnsEnd = route.indexOf("};", columnsStart);
  assert.ok(columnsStart >= 0 && columnsEnd > columnsStart, "public file record column allowlist must remain explicit");
  const publicColumns = route.slice(columnsStart, columnsEnd + 2);
  assert.doesNotMatch(publicColumns, /storageKey/, "public file record columns must not expose storage keys");
  assert.match(publicColumns, /storageStatus:\s*workerFileMetadata\.storageStatus/);
  assert.match(route, /storageKey:\s*workerFileMetadata\.storageKey/, "server internals still need the private storage key to read and delete bytes");
  assert.match(schema, /storageKey:\s*text\("storage_key"\)/);
  assert.match(schema, /storageStatus:\s*text\("storage_status"\)/);
});

test("metadata-only records never pretend file bytes are stored", () => {
  assert.match(route, /storageKey:\s*null/);
  assert.match(route, /storageStatus:\s*"metadata"/);
  assert.match(route, /storageStatus:\s*"stored"/);
  assert.match(route, /privateObjectStorage\(\)/, "stored state must be backed by an actual storage write");
});

test("private byte routes are owner-scoped, bounded, and fail closed", () => {
  assert.match(route, /MAX_STORED_SIZE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(route, /router\.put\([\s\S]*\/file-metadata\/:fileId\/content/);
  assert.match(route, /router\.get\("\/file-metadata\/:fileId\/content"/);
  assert.match(route, /express\.raw\(/);
  assert.match(route, /SAFE_UPLOAD_MIME_TYPES/);
  assert.match(route, /ObjectStorageUnavailableError/);
  assert.match(route, /status\(503\)/, "missing production storage must never be reported as a successful upload");
  assert.match(route, /ownedFileRecord\(ownerKey, fileId\)/, "content reads and writes must resolve through the current worker owner");
});

test("stored file replacement updates metadata only after the object write", () => {
  const putAt = route.indexOf("await storage.put(nextStorageKey, req.body)");
  const updateAt = route.indexOf(".update(workerFileMetadata)", putAt);
  assert.ok(putAt >= 0 && updateAt > putAt, "object bytes must be written before metadata claims stored status");
  assert.match(route, /storage\.delete\(nextStorageKey\)\.catch/, "failed DB updates must clean up the newly written object");
});

test("stored file deletion removes bytes before metadata", () => {
  const deleteRouteAt = route.indexOf('router.delete("/file-metadata/:fileId"');
  const objectDeleteAt = route.indexOf("await storage.delete(existing.storageKey)", deleteRouteAt);
  const metadataDeleteAt = route.indexOf(".delete(workerFileMetadata)", objectDeleteAt);
  assert.ok(deleteRouteAt >= 0 && objectDeleteAt > deleteRouteAt && metadataDeleteAt > objectDeleteAt, "private bytes must be removed before the database record disappears");
});

test("file metadata validates type, filename, and bounded size", () => {
  assert.match(route, /FILE_KINDS = new Set\(\["certification", "document", "profile-photo"\]\)/);
  assert.match(route, /name\.length <= 255/);
  assert.match(route, /MAX_METADATA_SIZE_BYTES/);
  assert.match(route, /Number\.isInteger\(sizeBytes\)/);
  assert.match(route, /\\u0000-\\u001f/, "filenames and MIME values must reject control characters");
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

test("profile photo replacement keeps one current stored choice where cleanup succeeds", () => {
  assert.match(route, /existing\.kind === "profile-photo"/);
  assert.match(route, /ne\(workerFileMetadata\.id, fileId\)/);
  assert.match(route, /await storage\.delete\(stale\.storageKey\)/);
});

test("Worker Setup file list uses real byte upload when available and tells the truth otherwise", () => {
  assert.match(panel, /\/api\/file-metadata\/\$\{record\.id\}\/content/);
  assert.match(panel, /storageStatus === 'stored'/);
  assert.match(panel, /stored privately/);
  assert.match(panel, /does not have private byte storage enabled/);
  assert.match(panel, /filename \+ details only/);
});
