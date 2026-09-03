import { Router, type IRouter } from "express";
import { PREVIEW_OWNER_KEY } from "../domain/worker-owner";
import { runWithWorkerPrincipal } from "../domain/worker-context";

const router: IRouter = Router();

router.use((_req, _res, next) =>
  runWithWorkerPrincipal({ kind: "preview", ownerKey: PREVIEW_OWNER_KEY, subject: null }, next),
);

export default router;
