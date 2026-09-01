import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workerIdentityRouter from "./worker-identity";
import credentialRouter from "./credentials";
import crewKitRouter from "./crew-kit";
import fileMetadataRouter from "./file-metadata";
import ownershipGateRouter from "./ownership-gate";
import stagewireRouter from "./stagewire";
import correctionRouter from "./corrections";
import openCallEditRouter from "./open-call-edits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workerIdentityRouter);
router.use(credentialRouter);
router.use(crewKitRouter);
router.use(fileMetadataRouter);
router.use(ownershipGateRouter);
router.use(correctionRouter);
router.use(openCallEditRouter);
router.use(stagewireRouter);

export default router;
