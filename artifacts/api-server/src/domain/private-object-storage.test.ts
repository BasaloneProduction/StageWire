import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  newStorageKey,
  ObjectStorageUnavailableError,
  privateObjectStorage,
} from "./private-object-storage.ts";

test("storage keys are opaque and do not expose worker owner ids", () => {
  const ownerKey = "worker-secret-owner-key";
  const key = newStorageKey(ownerKey, 42);
  assert.match(key, /^[a-f0-9]{24}\/42\/[0-9a-f-]{36}$/);
  assert.doesNotMatch(key, /worker-secret-owner-key/);
});

test("development storage can privately put, read, and delete bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stagewire-storage-test-"));
  const previous = process.env["STAGEWIRE_LOCAL_STORAGE_DIR"];
  process.env["STAGEWIRE_LOCAL_STORAGE_DIR"] = root;
  try {
    const storage = privateObjectStorage("test");
    const key = newStorageKey("worker-a", 7);
    await storage.put(key, Buffer.from("private stagewire file"));
    assert.equal((await storage.get(key))?.toString("utf8"), "private stagewire file");
    await storage.delete(key);
    assert.equal(await storage.get(key), null);
  } finally {
    if (previous === undefined) delete process.env["STAGEWIRE_LOCAL_STORAGE_DIR"];
    else process.env["STAGEWIRE_LOCAL_STORAGE_DIR"] = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("production refuses local filesystem storage until a real provider is configured", () => {
  assert.throws(() => privateObjectStorage("production"), ObjectStorageUnavailableError);
});
