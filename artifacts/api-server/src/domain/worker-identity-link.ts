import { and, eq } from "drizzle-orm";
import { db, workerIdentities } from "@workspace/db";
import { currentAuthenticatedWorker } from "./worker-context";
import { workerIdentityForVerifiedSubject } from "./worker-identity-map";

export type LinkWorkerIdentityResult =
  | { status: "linked" }
  | { status: "already-linked" }
  | { status: "conflict" };

function cleanRequired(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new Error(`StageWire ${label} cannot be blank.`);
  return clean;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

export async function linkVerifiedIdentityToCurrentWorker(
  provider: string,
  subject: string,
): Promise<LinkWorkerIdentityResult> {
  const worker = currentAuthenticatedWorker();
  const cleanProvider = cleanRequired(provider, "identity provider");
  const cleanSubject = cleanRequired(subject, "identity subject");
  const existing = await workerIdentityForVerifiedSubject(cleanProvider, cleanSubject);

  if (existing) {
    return existing.ownerKey === worker.ownerKey
      ? { status: "already-linked" }
      : { status: "conflict" };
  }

  try {
    await db.insert(workerIdentities).values({
      provider: cleanProvider,
      subject: cleanSubject,
      ownerKey: worker.ownerKey,
    });
    return { status: "linked" };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await db
      .select({ ownerKey: workerIdentities.ownerKey })
      .from(workerIdentities)
      .where(and(eq(workerIdentities.provider, cleanProvider), eq(workerIdentities.subject, cleanSubject)))
      .limit(1);
    return winner[0]?.ownerKey === worker.ownerKey
      ? { status: "already-linked" }
      : { status: "conflict" };
  }
}
