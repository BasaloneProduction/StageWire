import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, workerFileMetadata, workerProfiles } from "@workspace/db";
import { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";
import { PREVIEW_OWNER_KEY } from "../domain/worker-owner";

const router: IRouter = Router();

const FILE_KINDS = new Set(["certification", "document", "profile-photo"]);
const MAX_METADATA_SIZE_BYTES = 1024 * 1024 * 1024;
const fileRecordColumns = {
  id: workerFileMetadata.id,
  kind: workerFileMetadata.kind,
  name: workerFileMetadata.name,
  sizeBytes: workerFileMetadata.sizeBytes,
  mimeType: workerFileMetadata.mimeType,
  storageStatus: workerFileMetadata.storageStatus,
  createdAt: workerFileMetadata.createdAt,
  updatedAt: workerFileMetadata.updatedAt,
};

async function ensureFileOwner() {
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

function cleanKind(value: unknown) {
  const kind = typeof value === "string" ? value.trim() : "";
  return FILE_KINDS.has(kind) ? kind : null;
}

function cleanName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name && name.length <= 255 ? name : null;
}

function cleanMimeType(value: unknown) {
  const mimeType = typeof value === "string" ? value.trim() : "";
  return mimeType.slice(0, 200);
}

function cleanSize(value: unknown) {
  const sizeBytes = Number(value ?? 0);
  return Number.isInteger(sizeBytes) && sizeBytes >= 0 && sizeBytes <= MAX_METADATA_SIZE_BYTES ? sizeBytes : null;
}

router.get("/file-metadata", async (req, res, next) => {
  try {
    const ownerKey = await ensureFileOwner();
    const kind = req.query.kind === undefined ? null : cleanKind(req.query.kind);
    if (req.query.kind !== undefined && !kind) return res.status(400).json({ error: "Unknown file metadata kind." });

    const rows = await db
      .select(fileRecordColumns)
      .from(workerFileMetadata)
      .where(kind
        ? and(eq(workerFileMetadata.ownerKey, ownerKey), eq(workerFileMetadata.kind, kind))
        : eq(workerFileMetadata.ownerKey, ownerKey))
      .orderBy(asc(workerFileMetadata.createdAt), asc(workerFileMetadata.id));

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/file-metadata", async (req, res, next) => {
  try {
    const ownerKey = await ensureFileOwner();
    const kind = cleanKind(req.body?.kind);
    const name = cleanName(req.body?.name);
    const sizeBytes = cleanSize(req.body?.sizeBytes);
    const mimeType = cleanMimeType(req.body?.mimeType);
    if (!kind || !name || sizeBytes === null) {
      return res.status(400).json({ error: "Check the file type, filename, and size before saving." });
    }

    const result = await db.transaction(async (tx) => {
      if (kind !== "profile-photo") {
        const existing = (await tx
          .select(fileRecordColumns)
          .from(workerFileMetadata)
          .where(and(
            eq(workerFileMetadata.ownerKey, ownerKey),
            eq(workerFileMetadata.kind, kind),
            eq(workerFileMetadata.name, name),
            eq(workerFileMetadata.sizeBytes, sizeBytes),
            eq(workerFileMetadata.mimeType, mimeType),
            eq(workerFileMetadata.storageStatus, "metadata"),
          ))
          .limit(1))[0];
        if (existing) return { record: existing, created: false };
      } else {
        await tx
          .delete(workerFileMetadata)
          .where(and(
            eq(workerFileMetadata.ownerKey, ownerKey),
            eq(workerFileMetadata.kind, "profile-photo"),
            eq(workerFileMetadata.storageStatus, "metadata"),
          ));
      }

      const record = (await tx.insert(workerFileMetadata).values({
        ownerKey,
        kind,
        name,
        sizeBytes,
        mimeType,
        storageKey: null,
        storageStatus: "metadata",
      }).returning(fileRecordColumns))[0];
      return { record, created: true };
    });

    return res.status(result.created ? 201 : 200).json(result.record);
  } catch (error) {
    return next(error);
  }
});

router.delete("/file-metadata/:fileId", async (req, res, next) => {
  try {
    const ownerKey = await ensureFileOwner();
    const fileId = Number(req.params.fileId);
    if (!Number.isInteger(fileId) || fileId <= 0) return res.status(400).json({ error: "That file record ID is not valid." });

    const existing = (await db
      .select({ id: workerFileMetadata.id, storageStatus: workerFileMetadata.storageStatus })
      .from(workerFileMetadata)
      .where(and(eq(workerFileMetadata.id, fileId), eq(workerFileMetadata.ownerKey, ownerKey)))
      .limit(1))[0];
    if (!existing) return res.status(404).json({ error: "File record not found." });
    if (existing.storageStatus === "stored") {
      return res.status(409).json({ error: "Stored file removal is not enabled until secure object deletion is wired." });
    }

    await db
      .delete(workerFileMetadata)
      .where(and(eq(workerFileMetadata.id, fileId), eq(workerFileMetadata.ownerKey, ownerKey)));
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
