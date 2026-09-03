import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createAuthReadinessRouter } from "./auth-readiness";
import workerIdentityRouter from "./worker-identity";
import credentialRouter from "./credentials";
import crewKitRouter from "./crew-kit";
import fileMetadataRouter from "./file-metadata";
import ownershipGateRouter from "./ownership-gate";
import stagewireRouter from "./stagewire";
import correctionRouter from "./corrections";
import openCallEditRouter from "./open-call-edits";
import { createWorkerAuthRouter } from "../domain/worker-auth-router";
import { sessionWorkerMiddleware } from "../domain/session-worker-middleware";
import {
  createSupabaseEmailAuthRouter,
  createSupabaseIdentityResolver,
  supabaseAuthConfig,
} from "../domain/supabase-worker-auth";

const router: IRouter = Router();
const authConfig = supabaseAuthConfig();

router.use(healthRouter);
router.use(createAuthReadinessRouter(Boolean(authConfig)));

if (authConfig) {
  router.use(createSupabaseEmailAuthRouter(authConfig));
  router.use(createWorkerAuthRouter(createSupabaseIdentityResolver(authConfig)));
  router.use(sessionWorkerMiddleware());
} else {
  router.use(workerIdentityRouter);
}

router.use(credentialRouter);
router.use(crewKitRouter);
router.use(fileMetadataRouter);
router.use(ownershipGateRouter);
router.use(correctionRouter);
router.use(openCallEditRouter);
router.use(stagewireRouter);

export default router;
