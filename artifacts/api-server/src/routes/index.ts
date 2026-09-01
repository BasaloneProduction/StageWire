import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stagewireRouter from "./stagewire";
import correctionRouter from "./corrections";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stagewireRouter);
router.use(correctionRouter);

export default router;
