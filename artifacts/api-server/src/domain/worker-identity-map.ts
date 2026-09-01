import { and, eq } from "drizzle-orm";
import { db, workerIdentities } from "@workspace/db";
import type { WorkerPrincipal } from "./worker-context";

function cleanIdentityPart(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new Error(`StageWire ${label} cannot be blank.`);
  return clean;
}

export async function authenticatedPrincipalForIdentity(
  provider: string,
  subject: string,
): Promise<WorkerPrincipal | null> {
  const cleanProvider = cleanIdentityPart(provider, "identity provider");
  const cleanSubject = cleanIdentityPart(subject, "identity subject");
  const row = (
    await db
      .select({ ownerKey: workerIdentities.ownerKey })
      .from(workerIdentities)
      .where(and(eq(workerIdentities.provider, cleanProvider), eq(workerIdentities.subject, cleanSubject)))
      .limit(1)
  )[0];

  if (!row) return null;
  return {
    kind: "authenticated",
    ownerKey: row.ownerKey,
    subject: `${cleanProvider}:${cleanSubject}`,
  };
}
