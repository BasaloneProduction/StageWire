import { Router, type IRouter } from "express";
import { PREVIEW_OWNER_KEY } from "../domain/worker-owner";
import { runWithWorkerOwner } from "../domain/worker-context";

const router: IRouter = Router();

router.use((_req, _res, next) => runWithWorkerOwner(PREVIEW_OWNER_KEY, next));

export default router;
