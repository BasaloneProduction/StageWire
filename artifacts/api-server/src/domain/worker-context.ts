import { AsyncLocalStorage } from "node:async_hooks";

const workerOwnerStorage = new AsyncLocalStorage<string>();

export function runWithWorkerOwner<T>(ownerKey: string, work: () => T): T {
  const clean = ownerKey.trim();
  if (!clean) throw new Error("StageWire worker identity cannot be blank.");
  return workerOwnerStorage.run(clean, work);
}

export function currentWorkerOwnerKey() {
  const ownerKey = workerOwnerStorage.getStore();
  if (!ownerKey) throw new Error("StageWire worker identity is missing from this request.");
  return ownerKey;
}
