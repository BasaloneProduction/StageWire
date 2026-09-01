import { Router, type IRouter, type Request, type Response } from "express";
import type { VerifiedExternalIdentity, VerifiedIdentityResolver } from "./authenticated-worker-middleware";
import { bootstrapWorkerAccountForIdentity } from "./worker-account";
import {
  createWorkerSessionForIdentity,
  principalForSessionToken,
  revokeWorkerSession,
} from "./worker-session-store";
import {
  clearSessionCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "./worker-session-token";

async function verifiedIdentity(resolveVerifiedIdentity: VerifiedIdentityResolver, req: Request) {
  return resolveVerifiedIdentity(req);
}

function setSessionCookie(res: Response, token: string, expiresAt: string) {
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(process.env.NODE_ENV, expiresAt));
}

export function createWorkerAuthRouter(resolveVerifiedIdentity: VerifiedIdentityResolver): IRouter {
  const router: IRouter = Router();

  router.post("/auth/session", async (req, res, next) => {
    try {
      const identity = await verifiedIdentity(resolveVerifiedIdentity, req);
      if (!identity) return res.status(401).json({ error: "Verified sign-in is required." });
      const session = await createWorkerSessionForIdentity(identity.provider, identity.subject);
      if (!session) {
        return res.status(403).json({ error: "This verified sign-in is not linked to a StageWire worker account yet." });
      }
      setSessionCookie(res, session.token, session.expiresAt);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  router.post("/auth/signup", async (req, res, next) => {
    try {
      const identity: VerifiedExternalIdentity | null = await verifiedIdentity(resolveVerifiedIdentity, req);
      if (!identity) return res.status(401).json({ error: "Verified sign-in is required before creating a StageWire account." });

      const account = await bootstrapWorkerAccountForIdentity(identity.provider, identity.subject);
      const session = await createWorkerSessionForIdentity(identity.provider, identity.subject);
      if (!session) throw new Error("StageWire created the worker account but could not establish its session.");

      setSessionCookie(res, session.token, session.expiresAt);
      return res.status(account.created ? 201 : 200).json({ authenticated: true, created: account.created });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/auth/session", async (req, res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      if (typeof token !== "string" || !token.trim()) return res.json({ authenticated: false });
      const principal = await principalForSessionToken(token);
      return res.json({ authenticated: Boolean(principal) });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/auth/session", async (req, res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      if (typeof token === "string" && token.trim()) await revokeWorkerSession(token);
      res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions(process.env.NODE_ENV));
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
