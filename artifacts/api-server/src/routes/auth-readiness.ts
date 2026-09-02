import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/auth/readiness", (_req, res) => {
  return res.json({
    mode: "preview",
    signInAvailable: false,
    recordsFollowSignIn: false,
    provider: null,
  });
});

export default router;
