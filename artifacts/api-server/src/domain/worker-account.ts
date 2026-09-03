import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, workerIdentities, workerProfiles } from "@workspace/db";

function cleanRequired(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new Error(`StageWire ${label} cannot be blank.`);
  return clean;
}

async function existingOwnerKey(provider: string, subject: string) {
  return (
    await db
      .select({ ownerKey: workerIdentities.ownerKey })
      .from(workerIdentities)
      .where(and(eq(workerIdentities.provider, provider), eq(workerIdentities.subject, subject)))
      .limit(1)
  )[0]?.ownerKey ?? null;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

export async function bootstrapWorkerAccountForIdentity(
  provider: string,
  subject: string,
  profile?: { displayName?: string; primaryRole?: string },
) {
  const cleanProvider = cleanRequired(provider, "identity provider");
  const cleanSubject = cleanRequired(subject, "identity subject");
  const existing = await existingOwnerKey(cleanProvider, cleanSubject);
  if (existing) return { ownerKey: existing, created: false as const };

  const ownerKey = `worker_${randomUUID()}`;
  const displayName = profile?.displayName?.trim() || "StageWire Worker";
  const primaryRole = profile?.primaryRole?.trim() || "Stagehand";

  try {
    await db.transaction(async (tx) => {
      await tx.insert(workerProfiles).values({
        ownerKey,
        displayName,
        primaryRole,
        privateByDefault: true,
      });
      await tx.insert(workerIdentities).values({
        provider: cleanProvider,
        subject: cleanSubject,
        ownerKey,
      });
    });
    return { ownerKey, created: true as const };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await existingOwnerKey(cleanProvider, cleanSubject);
    if (!winner) throw error;
    return { ownerKey: winner, created: false as const };
  }
}
