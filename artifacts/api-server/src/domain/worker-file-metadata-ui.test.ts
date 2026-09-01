import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync(new URL("../../../stagewire/src/components/worker-file-metadata.tsx", import.meta.url), "utf8");
const setup = fs.readFileSync(new URL("../../../stagewire/src/pages/worker-setup.tsx", import.meta.url), "utf8");

test("Worker Setup uses server-backed document and certification metadata", () => {
  assert.match(setup, /WorkerFileMetadataPanel/);
  assert.doesNotMatch(setup, /FILES_KEY|readFiles\(|pickFiles\(|removeFile\(/, "Worker Setup must not keep document/certification file lists browser-only");
  assert.match(panel, /fetch\(path/);
  assert.match(panel, /'\/api\/file-metadata'/);
  assert.match(panel, /method:\s*'POST'/);
  assert.match(panel, /method:\s*'DELETE'/);
});

test("legacy browser file lists are import-only", () => {
  assert.match(panel, /stagewire-profile-files-v14/);
  assert.match(panel, /localStorage\.getItem\(LEGACY_FILES_KEY\)/);
  assert.match(panel, /localStorage\.removeItem\(LEGACY_FILES_KEY\)/);
  assert.doesNotMatch(panel, /localStorage\.setItem\(LEGACY_FILES_KEY/, "new file metadata must never be written back to localStorage");
});

test("photo preview stays explicitly local until Worker Setup is migrated to private photo storage", () => {
  assert.match(setup, /stagewire-profile-photo-preview-v14/);
  assert.match(setup, /photo preview itself still stays local to this browser/i);
  assert.match(setup, /secure image storage exists/i);
});

test("file panel distinguishes metadata-only records from privately stored bytes", () => {
  assert.match(panel, /storageStatus === 'stored'/);
  assert.match(panel, /stored privately/);
  assert.match(panel, /filename \+ details only/);
  assert.match(panel, /\/api\/file-metadata\/\$\{record\.id\}\/content/);
  assert.match(panel, /does not have private byte storage enabled/);
  assert.match(panel, /moves filename, size, and file-type metadata only/i);
});
