import { and, eq } from "drizzle-orm";
import { calls, workerProfiles } from "@workspace/db";
import { currentWorkerOwnerKey } from "./worker-context";

export const PREVIEW_OWNER_KEY = "preview-worker-v14";

export function ownedCallWhere(id: number) {
  return and(eq(calls.id, id), eq(calls.ownerKey, currentWorkerOwnerKey()));
}

export function ownedCallsWhere() {
  return eq(calls.ownerKey, currentWorkerOwnerKey());
}

export function ownedProfileWhere() {
  return eq(workerProfiles.ownerKey, currentWorkerOwnerKey());
}
