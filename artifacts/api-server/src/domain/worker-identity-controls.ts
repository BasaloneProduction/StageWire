import { and, asc, eq } from "drizzle-orm";
import { db, workerIdentities, workerProfiles } from "@workspace/db";
import { currentAuthenticatedWorker } from "./worker-context";

export type UnlinkWorkerIdentityResult =
  | { status: "unlinked" }
  | { status: "not-found" }
  | { status: "last-identity" };

export async function listCurrentWorkerIdentities() {
  const worker = currentAuthenticatedWorker();
  return db
    .select({
      id: workerIdentities.id,
      provider: workerIdentities.provider,
      createdAt: workerIdentities.createdAt,
    })
    .from(workerIdentities)
    .where(eq(workerIdentities.ownerKey, worker.ownerKey))
    .orderBy(asc(workerIdentities.createdAt), asc(workerIdentities.id));
}

export async function unlinkCurrentWorkerIdentity(identityId: number): Promise<UnlinkWorkerIdentityResult> {
  const worker = currentAuthenticatedWorker();
  if (!Number.isInteger(identityId) || identityId <= 0) return { status: "not-found" };

  return db.transaction(async (tx) => {
    // Serialize identity changes for one worker so concurrent unlink requests cannot both remove the last login.
    await tx
      .select({ ownerKey: workerProfiles.ownerKey })
      .from(workerProfiles)
      .where(eq(workerProfiles.ownerKey, worker.ownerKey))
      .for("update")
      .limit(1);

    const identities = await tx
      .select({ id: workerIdentities.id })
      .from(workerIdentities)
      .where(eq(workerIdentities.ownerKey, worker.ownerKey))
      .orderBy(asc(workerIdentities.id));

    if (!identities.some((identity) => identity.id === identityId)) return { status: "not-found" };
    if (identities.length <= 1) return { status: "last-identity" };

    const removed = await tx
      .delete(workerIdentities)
      .where(and(eq(workerIdentities.id, identityId), eq(workerIdentities.ownerKey, worker.ownerKey)))
      .returning({ id: workerIdentities.id });

    return removed.length > 0 ? { status: "unlinked" } : { status: "not-found" };
  });
}
