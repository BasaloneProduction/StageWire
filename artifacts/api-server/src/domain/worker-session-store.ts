import { and, eq, gt, isNull } from "drizzle-orm";
import { db, workerIdentities, workerSessions } from "@workspace/db";
import type { WorkerPrincipal } from "./worker-context";
import { workerIdentityForVerifiedSubject } from "./worker-identity-map";
import {
  createSessionToken,
  DEFAULT_SESSION_TTL_MS,
  hashSessionToken,
} from "./worker-session-token";

function validTtl(ttlMs: number) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("StageWire session lifetime must be greater than zero.");
  return ttlMs;
}

export async function createWorkerSessionForIdentity(
  provider: string,
  subject: string,
  now = new Date(),
  ttlMs = DEFAULT_SESSION_TTL_MS,
) {
  const identity = await workerIdentityForVerifiedSubject(provider, subject);
  if (!identity) return null;

  const token = createSessionToken();
  const sessionHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + validTtl(ttlMs)).toISOString();

  await db.insert(workerSessions).values({
    sessionHash,
    ownerKey: identity.ownerKey,
    identityId: identity.id,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function principalForSessionToken(token: string, now = new Date()): Promise<WorkerPrincipal | null> {
  if (!token.trim()) return null;
  const sessionHash = hashSessionToken(token);
  const row = (
    await db
      .select({
        sessionOwnerKey: workerSessions.ownerKey,
        identityOwnerKey: workerIdentities.ownerKey,
        provider: workerIdentities.provider,
        subject: workerIdentities.subject,
      })
      .from(workerSessions)
      .innerJoin(workerIdentities, eq(workerSessions.identityId, workerIdentities.id))
      .where(
        and(
          eq(workerSessions.sessionHash, sessionHash),
          gt(workerSessions.expiresAt, now.toISOString()),
          isNull(workerSessions.revokedAt),
        ),
      )
      .limit(1)
  )[0];

  if (!row || row.sessionOwnerKey !== row.identityOwnerKey) return null;
  return {
    kind: "authenticated",
    ownerKey: row.sessionOwnerKey,
    subject: `${row.provider}:${row.subject}`,
  };
}

export async function revokeWorkerSession(token: string, now = new Date()) {
  if (!token.trim()) return false;
  const revoked = await db
    .update(workerSessions)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(workerSessions.sessionHash, hashSessionToken(token)), isNull(workerSessions.revokedAt)))
    .returning({ sessionHash: workerSessions.sessionHash });
  return revoked.length > 0;
}
