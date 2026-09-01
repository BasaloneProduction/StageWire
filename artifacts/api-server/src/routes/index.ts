import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workerIdentityRouter from "./worker-identity";
import ownershipGateRouter from "./ownership-gate";
import stagewireRouter from "./stagewire";
import correctionRouter from "./corrections";
import openCallEditRouter from "./open-call-edits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workerIdentityRouter);
router.use(ownershipGateRouter);
router.use(correctionRouter);
router.use(openCallEditRouter);
router.use(stagewireRouter);

export default router;
