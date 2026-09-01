import { and, eq } from "drizzle-orm";
import { db, workerIdentities } from "@workspace/db";
import type { WorkerPrincipal } from "./worker-context";

function cleanIdentityPart(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new Error(`StageWire ${label} cannot be blank.`);
  return clean;
}

export async function workerIdentityForVerifiedSubject(provider: string, subject: string) {
  const cleanProvider = cleanIdentityPart(provider, "identity provider");
  const cleanSubject = cleanIdentityPart(subject, "identity subject");
  return (
    await db
      .select({
        id: workerIdentities.id,
        ownerKey: workerIdentities.ownerKey,
        provider: workerIdentities.provider,
        subject: workerIdentities.subject,
      })
      .from(workerIdentities)
      .where(and(eq(workerIdentities.provider, cleanProvider), eq(workerIdentities.subject, cleanSubject)))
      .limit(1)
  )[0] ?? null;
}

export async function authenticatedPrincipalForIdentity(
  provider: string,
  subject: string,
): Promise<WorkerPrincipal | null> {
  const row = await workerIdentityForVerifiedSubject(provider, subject);
  if (!row) return null;
  return {
    kind: "authenticated",
    ownerKey: row.ownerKey,
    subject: `${row.provider}:${row.subject}`,
  };
}
