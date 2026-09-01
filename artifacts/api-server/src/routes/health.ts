import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, calls, workerProfiles } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await Promise.all([
      db.select({ ownerKey: calls.ownerKey }).from(calls).limit(1),
      db.select({ ownerKey: workerProfiles.ownerKey }).from(workerProfiles).limit(1),
    ]);
    return res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch {
    return res.status(503).json(HealthCheckResponse.parse({ status: "database-unready" }));
  }
});

export default router;
