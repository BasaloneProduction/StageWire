import { and, asc, eq, ne } from "drizzle-orm";
import express, { Router, type IRouter } from "express";
import { db, workerFileMetadata, workerProfiles } from "@workspace/db";
import {
  newStorageKey,
  ObjectStorageUnavailableError,
  privateObjectStorage,
} from "../domain/private-object-storage";
import { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";
import { PREVIEW_OWNER_KEY } from "../domain/worker-owner";

const router: IRouter = Router();

const FILE_KINDS = new Set(["certification", "document", "profile-photo"]);
const MAX_METADATA_SIZE_BYTES = 1024 * 1024 * 1024;
const MAX_STORED_SIZE_BYTES = 20 * 1024 * 1024;
const SAFE_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
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
  return name && name.length <= 255 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

function cleanMimeType(value: unknown) {
  const mimeType = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /[\u0000-\u001f\u007f]/.test(mimeType) ? "" : mimeType.slice(0, 200);
}

function cleanSize(value: unknown) {
  const sizeBytes = Number(value ?? 0);
  return Number.isInteger(sizeBytes) && sizeBytes >= 0 && sizeBytes <= MAX_METADATA_SIZE_BYTES ? sizeBytes : null;
}

function fileIdParam(value: string | undefined) {
  const fileId = Number(value);
  return Number.isInteger(fileId) && fileId > 0 ? fileId : null;
}

function storageUnavailable(error: unknown) {
  return error instanceof ObjectStorageUnavailableError;
}

async function ownedFileRecord(ownerKey: string, fileId: number) {
  return (await db
    .select({
      id: workerFileMetadata.id,
      ownerKey: workerFileMetadata.ownerKey,
      kind: workerFileMetadata.kind,
      name: workerFileMetadata.name,
      sizeBytes: workerFileMetadata.sizeBytes,
      mimeType: workerFileMetadata.mimeType,
      storageKey: workerFileMetadata.storageKey,
      storageStatus: workerFileMetadata.storageStatus,
    })
    .from(workerFileMetadata)
    .where(and(eq(workerFileMetadata.id, fileId), eq(workerFileMetadata.ownerKey, ownerKey)))
    .limit(1))[0];
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

router.put(
  "/file-metadata/:fileId/content",
  express.raw({ type: () => true, limit: MAX_STORED_SIZE_BYTES }),
  async (req, res, next) => {
    try {
      const ownerKey = await ensureFileOwner();
      const fileId = fileIdParam(req.params.fileId);
      if (!fileId) return res.status(400).json({ error: "That file record ID is not valid." });
      const existing = await ownedFileRecord(ownerKey, fileId);
      if (!existing) return res.status(404).json({ error: "File record not found." });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Choose a file before uploading." });
      if (req.body.length > MAX_STORED_SIZE_BYTES) return res.status(413).json({ error: "Files must be 20 MB or smaller." });

      const mimeType = cleanMimeType(req.get("content-type"));
      if (!SAFE_UPLOAD_MIME_TYPES.has(mimeType)) {
        return res.status(415).json({ error: "StageWire currently stores PDF, Word, JPEG, PNG, and WebP files." });
      }
      if (existing.kind === "profile-photo" && !mimeType.startsWith("image/")) {
        return res.status(415).json({ error: "Profile photos must be JPEG, PNG, or WebP images." });
      }

      const storage = privateObjectStorage();
      const nextStorageKey = newStorageKey(ownerKey, fileId);
      await storage.put(nextStorageKey, req.body);
      let updated;
      try {
        updated = (await db
          .update(workerFileMetadata)
          .set({
            sizeBytes: req.body.length,
            mimeType,
            storageKey: nextStorageKey,
            storageStatus: "stored",
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(workerFileMetadata.id, fileId), eq(workerFileMetadata.ownerKey, ownerKey)))
          .returning(fileRecordColumns))[0];
      } catch (error) {
        await storage.delete(nextStorageKey).catch(() => undefined);
        throw error;
      }

      if (existing.storageStatus === "stored" && existing.storageKey && existing.storageKey !== nextStorageKey) {
        await storage.delete(existing.storageKey).catch(() => undefined);
      }

      if (existing.kind === "profile-photo") {
        const stalePhotos = await db
          .select({ id: workerFileMetadata.id, storageKey: workerFileMetadata.storageKey, storageStatus: workerFileMetadata.storageStatus })
          .from(workerFileMetadata)
          .where(and(
            eq(workerFileMetadata.ownerKey, ownerKey),
            eq(workerFileMetadata.kind, "profile-photo"),
            ne(workerFileMetadata.id, fileId),
          ));
        for (const stale of stalePhotos) {
          if (stale.storageStatus === "stored" && stale.storageKey) {
            try {
              await storage.delete(stale.storageKey);
            } catch {
              continue;
            }
          }
          await db.delete(workerFileMetadata).where(and(
            eq(workerFileMetadata.id, stale.id),
            eq(workerFileMetadata.ownerKey, ownerKey),
          ));
        }
      }
      return res.json(updated);
    } catch (error) {
      if (storageUnavailable(error)) return res.status(503).json({ error: "Secure file storage is not configured on this build yet." });
      return next(error);
    }
  },
);

router.get("/file-metadata/:fileId/content", async (req, res, next) => {
  try {
    const ownerKey = await ensureFileOwner();
    const fileId = fileIdParam(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: "That file record ID is not valid." });
    const existing = await ownedFileRecord(ownerKey, fileId);
    if (!existing) return res.status(404).json({ error: "File record not found." });
    if (existing.storageStatus !== "stored" || !existing.storageKey) {
      return res.status(409).json({ error: "This record has filename details only; file contents have not been stored." });
    }

    const storage = privateObjectStorage();
    const data = await storage.get(existing.storageKey);
    if (!data) return res.status(410).json({ error: "The stored file could not be found. Keep your original copy while this is investigated." });
    res.setHeader("Content-Type", cleanMimeType(existing.mimeType) || "application/octet-stream");
    res.setHeader("Content-Length", String(data.length));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(existing.name)}`);
    return res.send(data);
  } catch (error) {
    if (storageUnavailable(error)) return res.status(503).json({ error: "Secure file storage is not configured on this build yet." });
    return next(error);
  }
});

router.delete("/file-metadata/:fileId", async (req, res, next) => {
  try {
    const ownerKey = await ensureFileOwner();
    const fileId = fileIdParam(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: "That file record ID is not valid." });

    const existing = await ownedFileRecord(ownerKey, fileId);
    if (!existing) return res.status(404).json({ error: "File record not found." });
    if (existing.storageStatus === "stored" && existing.storageKey) {
      const storage = privateObjectStorage();
      await storage.delete(existing.storageKey);
    }

    await db
      .delete(workerFileMetadata)
      .where(and(eq(workerFileMetadata.id, fileId), eq(workerFileMetadata.ownerKey, ownerKey)));
    return res.status(204).send();
  } catch (error) {
    if (storageUnavailable(error)) return res.status(503).json({ error: "Stored file removal is unavailable until secure storage is configured." });
    return next(error);
  }
});

export default router;
