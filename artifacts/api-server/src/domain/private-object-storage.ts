import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type PrivateObjectStorage = {
  driver: "local-development";
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
};

export class ObjectStorageUnavailableError extends Error {
  constructor() {
    super("Secure file storage is not configured for this StageWire environment.");
    this.name = "ObjectStorageUnavailableError";
  }
}

function storageRoot() {
  return path.resolve(process.env["STAGEWIRE_LOCAL_STORAGE_DIR"] || path.join(process.cwd(), ".local", "stagewire-storage"));
}

function safeObjectPath(root: string, key: string) {
  if (!/^[a-f0-9]{24}\/\d+\/[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid StageWire storage key.");
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid StageWire storage path.");
  return resolved;
}

function localDevelopmentStorage(): PrivateObjectStorage {
  const root = storageRoot();
  return {
    driver: "local-development",
    async put(key, data) {
      const target = safeObjectPath(root, key);
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, data, { mode: 0o600 });
    },
    async get(key) {
      const target = safeObjectPath(root, key);
      try {
        return await readFile(target);
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      const target = safeObjectPath(root, key);
      await rm(target, { force: true });
    },
  };
}

export function privateObjectStorage(nodeEnv = process.env["NODE_ENV"]): PrivateObjectStorage {
  if (nodeEnv === "development" || nodeEnv === "test") return localDevelopmentStorage();
  throw new ObjectStorageUnavailableError();
}

export function newStorageKey(ownerKey: string, fileId: number) {
  const ownerBucket = createHash("sha256").update(ownerKey).digest("hex").slice(0, 24);
  return `${ownerBucket}/${fileId}/${randomUUID()}`;
}
