import { AsyncLocalStorage } from "node:async_hooks";

export type WorkerPrincipal =
  | { kind: "preview"; ownerKey: string; subject: null }
  | { kind: "authenticated"; ownerKey: string; subject: string };

const workerPrincipalStorage = new AsyncLocalStorage<WorkerPrincipal>();

function cleanRequired(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new Error(`StageWire worker ${label} cannot be blank.`);
  return clean;
}

export function runWithWorkerPrincipal<T>(principal: WorkerPrincipal, work: () => T): T {
  const ownerKey = cleanRequired(principal.ownerKey, "identity");
  const normalized: WorkerPrincipal = principal.kind === "authenticated"
    ? { kind: "authenticated", ownerKey, subject: cleanRequired(principal.subject, "subject") }
    : { kind: "preview", ownerKey, subject: null };
  return workerPrincipalStorage.run(normalized, work);
}

export function currentWorkerPrincipal() {
  const principal = workerPrincipalStorage.getStore();
  if (!principal) throw new Error("StageWire worker identity is missing from this request.");
  return principal;
}

export function currentWorkerOwnerKey() {
  return currentWorkerPrincipal().ownerKey;
}

export function currentAuthenticatedWorker() {
  const principal = currentWorkerPrincipal();
  if (principal.kind !== "authenticated") {
    throw new Error("StageWire worker authentication is required for this operation.");
  }
  return principal;
}
