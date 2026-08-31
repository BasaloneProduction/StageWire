import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stagewireRouter from "./stagewire";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stagewireRouter);

export default router;
