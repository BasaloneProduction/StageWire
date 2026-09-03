import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, calls, workerCredentials, workerCrewKitState, workerFileMetadata, workerProfiles } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await Promise.all([
      db.select({ ownerKey: calls.ownerKey }).from(calls).limit(1),
      db.select({
        ownerKey: workerProfiles.ownerKey,
        sharePhoto: workerProfiles.sharePhoto,
        shareHomeBase: workerProfiles.shareHomeBase,
        shareSkills: workerProfiles.shareSkills,
        shareCertifications: workerProfiles.shareCertifications,
        taxReservePercent: workerProfiles.taxReservePercent,
      }).from(workerProfiles).limit(1),
      db.select({ id: workerCredentials.id, ownerKey: workerCredentials.ownerKey }).from(workerCredentials).limit(1),
      db.select({ ownerKey: workerCrewKitState.ownerKey, updatedAt: workerCrewKitState.updatedAt }).from(workerCrewKitState).limit(1),
      db.select({ id: workerFileMetadata.id, ownerKey: workerFileMetadata.ownerKey, storageStatus: workerFileMetadata.storageStatus }).from(workerFileMetadata).limit(1),
    ]);
    return res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch {
    return res.status(503).json(HealthCheckResponse.parse({ status: "database-unready" }));
  }
});

export default router;
