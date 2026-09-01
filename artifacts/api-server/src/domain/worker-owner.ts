import { and, eq } from "drizzle-orm";
import { calls, workerProfiles } from "@workspace/db";

export const PREVIEW_OWNER_KEY = "preview-worker-v14";

export function ownedCallWhere(id: number) {
  return and(eq(calls.id, id), eq(calls.ownerKey, PREVIEW_OWNER_KEY));
}

export function ownedCallsWhere() {
  return eq(calls.ownerKey, PREVIEW_OWNER_KEY);
}

export function ownedProfileWhere() {
  return eq(workerProfiles.ownerKey, PREVIEW_OWNER_KEY);
}
