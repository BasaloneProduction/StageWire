import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const vault = fs.readFileSync(new URL("../../../stagewire/src/pages/worker-vault.tsx", import.meta.url), "utf8");

test("Vault file metadata comes from the worker API, not browser-only storage", () => {
  assert.match(vault, /fetch\('\/api\/file-metadata'/);
  assert.match(vault, /setFileMetadata\(await loadWorkerFileMetadata\(\)\)/);
  assert.doesNotMatch(vault, /stagewire-profile-files-v14|localStorage\.getItem\([^)]*FILES/, "Vault must not keep a separate browser-only document/certification source");
});

test("worker backup includes server file metadata and never claims to contain file bytes", () => {
  assert.match(vault, /fileMetadata,/);
  assert.match(vault, /Worker file metadata records are included; file bytes are not part of this JSON backup/);
  assert.doesNotMatch(vault, /localFileMetadata:/);
});

test("Vault does not offer a silently incomplete file-metadata backup", () => {
  assert.match(vault, /if \(filesError\)/);
  assert.match(vault, /The Vault could not load your worker file records/);
  const errorGuard = vault.indexOf("if (filesError)");
  const download = vault.indexOf("const downloadBackup");
  assert.ok(errorGuard >= 0 && download > errorGuard, "file metadata errors must block the normal Vault render before backup is available");
});

test("Vault distinguishes metadata-only records from stored objects", () => {
  assert.match(vault, /storageStatus === 'stored' \? 'stored file' : 'filename \+ details only'/);
  assert.match(vault, /Private file records/);
});
