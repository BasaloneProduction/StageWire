import { Router, type IRouter, type Request, type Response } from "express";
import type { VerifiedExternalIdentity, VerifiedIdentityResolver } from "./authenticated-worker-middleware";
import { bootstrapWorkerAccountForIdentity } from "./worker-account";
import { listCurrentWorkerIdentities, unlinkCurrentWorkerIdentity } from "./worker-identity-controls";
import { linkVerifiedIdentityToCurrentWorker } from "./worker-identity-link";
import { sessionWorkerMiddleware } from "./session-worker-middleware";
import {
  createWorkerSessionForIdentity,
  principalForSessionToken,
  revokeAllCurrentWorkerSessions,
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

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions(process.env.NODE_ENV));
}

export function createWorkerAuthRouter(resolveVerifiedIdentity: VerifiedIdentityResolver): IRouter {
  const router: IRouter = Router();
  const requireSession = sessionWorkerMiddleware();

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
      clearSessionCookie(res);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  router.get("/auth/identities", requireSession, async (_req, res, next) => {
    try {
      return res.json({ identities: await listCurrentWorkerIdentities() });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/auth/identities/link", requireSession, async (req, res, next) => {
    try {
      const identity = await verifiedIdentity(resolveVerifiedIdentity, req);
      if (!identity) return res.status(401).json({ error: "Verify the new sign-in before linking it to StageWire." });
      const result = await linkVerifiedIdentityToCurrentWorker(identity.provider, identity.subject);
      if (result.status === "conflict") {
        return res.status(409).json({ error: "That sign-in is already linked to another StageWire worker account." });
      }
      return res.status(result.status === "linked" ? 201 : 200).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/auth/identities/:identityId", requireSession, async (req, res, next) => {
    try {
      const identityId = Number(req.params.identityId);
      const result = await unlinkCurrentWorkerIdentity(identityId);
      if (result.status === "last-identity") {
        return res.status(409).json({ error: "Keep at least one sign-in method linked to your StageWire account." });
      }
      if (result.status === "not-found") return res.status(404).json({ error: "Linked sign-in not found." });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/auth/sessions", requireSession, async (_req, res, next) => {
    try {
      await revokeAllCurrentWorkerSessions();
      clearSessionCookie(res);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
