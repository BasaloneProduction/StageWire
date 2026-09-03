import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCredentialBody,
  CreateCredentialResponse,
  DeleteCredentialParams,
  ListCredentialsResponse,
  UpdateCredentialBody,
  UpdateCredentialParams,
  UpdateCredentialResponse,
} from "@workspace/api-zod";
import { db, workerCredentials, workerProfiles } from "@workspace/db";
import { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";
import { PREVIEW_OWNER_KEY } from "../domain/worker-owner";

const router: IRouter = Router();

function dateKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function cleanIssuer(value: string | undefined) {
  return value?.trim() ?? "";
}

function isValidationError(error: unknown) {
  return Boolean(error && typeof error === "object" && "issues" in error);
}

async function ensureCredentialOwner() {
  const ownerKey = currentWorkerOwnerKey();
  const existing = await db
    .select({ ownerKey: workerProfiles.ownerKey })
    .from(workerProfiles)
    .where(eq(workerProfiles.ownerKey, ownerKey))
    .limit(1);
  if (existing.length > 0) return ownerKey;

  if (currentWorkerPrincipal().kind !== "preview" || ownerKey !== PREVIEW_OWNER_KEY) {
    throw new Error("StageWire worker profile is missing for this authenticated identity.");
  }

  await db.insert(workerProfiles).values({
    ownerKey: PREVIEW_OWNER_KEY,
    displayName: "StageWire Worker",
    homeCityState: "New York, NY",
    primaryRole: "Stagehand",
    additionalRoles: ["Pusher"],
    yearsExperience: 8,
    skills: ["Load-in / load-out", "Deck work", "Forklift safety"],
    certifications: ["OSHA 10"],
    bio: "Live-production worker building a clear record of every call.",
    privateByDefault: true,
  }).onConflictDoNothing({ target: workerProfiles.ownerKey });

  return ownerKey;
}

function ownerCredentialWhere(id: number) {
  return and(eq(workerCredentials.id, id), eq(workerCredentials.ownerKey, currentWorkerOwnerKey()));
}

router.get("/credentials", async (_req, res, next) => {
  try {
    const ownerKey = await ensureCredentialOwner();
    const rows = await db
      .select()
      .from(workerCredentials)
      .where(eq(workerCredentials.ownerKey, ownerKey))
      .orderBy(asc(workerCredentials.createdAt), asc(workerCredentials.id));
    return res.json(ListCredentialsResponse.parse(rows));
  } catch (error) {
    return next(error);
  }
});

router.post("/credentials", async (req, res, next) => {
  try {
    const ownerKey = await ensureCredentialOwner();
    const input = CreateCredentialBody.parse(req.body);
    const name = input.name.trim();
    if (!name) return res.status(400).json({ error: "Add the credential name before saving." });

    const created = (await db.insert(workerCredentials).values({
      ownerKey,
      name,
      issuer: cleanIssuer(input.issuer),
      expires: dateKey(input.expires),
      status: input.status,
    }).returning())[0];
    return res.status(201).json(CreateCredentialResponse.parse(created));
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ error: "Check the credential name, status, and expiration date before saving." });
    return next(error);
  }
});

router.patch("/credentials/:credentialId", async (req, res, next) => {
  try {
    await ensureCredentialOwner();
    const { credentialId } = UpdateCredentialParams.parse(req.params);
    const input = UpdateCredentialBody.parse(req.body);
    const existing = (await db.select().from(workerCredentials).where(ownerCredentialWhere(credentialId)).limit(1))[0];
    if (!existing) return res.status(404).json({ error: "Credential not found." });

    const nextName = input.name === undefined ? existing.name : input.name.trim();
    if (!nextName) return res.status(400).json({ error: "Credential name cannot be blank." });

    const updated = (await db.update(workerCredentials).set({
      name: nextName,
      issuer: input.issuer === undefined ? existing.issuer : cleanIssuer(input.issuer),
      expires: input.expires === undefined ? existing.expires : dateKey(input.expires),
      status: input.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    }).where(ownerCredentialWhere(credentialId)).returning())[0];
    return res.json(UpdateCredentialResponse.parse(updated));
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ error: "Check the credential update before saving." });
    return next(error);
  }
});

router.delete("/credentials/:credentialId", async (req, res, next) => {
  try {
    await ensureCredentialOwner();
    const { credentialId } = DeleteCredentialParams.parse(req.params);
    const removed = await db
      .delete(workerCredentials)
      .where(ownerCredentialWhere(credentialId))
      .returning({ id: workerCredentials.id });
    if (removed.length === 0) return res.status(404).json({ error: "Credential not found." });
    return res.status(204).send();
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ error: "That credential ID is not valid." });
    return next(error);
  }
});

export default router;
