import { Router, type IRouter } from "express";
import { db, calls } from "@workspace/db";
import { ownedCallWhere } from "../domain/worker-owner";

const router: IRouter = Router();

router.use("/calls/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();

  const owned = (await db.select({ id: calls.id }).from(calls).where(ownedCallWhere(id)).limit(1))[0];
  if (!owned) return res.status(404).json({ error: "Call not found." });
  return next();
});

export default router;
