import type { RequestHandler } from "express";
import { runWithWorkerPrincipal } from "./worker-context";
import { principalForSessionToken } from "./worker-session-store";
import { SESSION_COOKIE_NAME } from "./worker-session-token";

export function sessionWorkerMiddleware(): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      if (typeof token !== "string" || !token.trim()) {
        return res.status(401).json({ error: "Sign in to access your StageWire worker records." });
      }

      const principal = await principalForSessionToken(token);
      if (!principal) {
        return res.status(401).json({ error: "Your StageWire session is no longer valid. Sign in again." });
      }

      return runWithWorkerPrincipal(principal, next);
    } catch (error) {
      return next(error);
    }
  };
}
