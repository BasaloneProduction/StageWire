import { Router, type IRouter } from "express";

export function createAuthReadinessRouter(signInAvailable: boolean): IRouter {
  const router: IRouter = Router();

  router.get("/auth/readiness", (_req, res) => {
    return res.json({
      mode: signInAvailable ? "production" : "preview",
      signInAvailable,
      recordsFollowSignIn: signInAvailable,
      provider: signInAvailable ? "supabase" : null,
    });
  });

  return router;
}
