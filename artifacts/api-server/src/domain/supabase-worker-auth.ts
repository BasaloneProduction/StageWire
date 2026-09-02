import { Router, type IRouter, type Request, type Response } from "express";
import type { VerifiedExternalIdentity, VerifiedIdentityResolver } from "./authenticated-worker-middleware";
import { bootstrapWorkerAccountForIdentity } from "./worker-account";
import { createWorkerSessionForIdentity } from "./worker-session-store";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./worker-session-token";

export type SupabaseAuthConfig = {
  url: string;
  publishableKey: string;
};

const PROVIDER = "supabase";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

function cleanHostedUrl(raw: string) {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    if (!url.hostname.endsWith(".supabase.co")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function supabaseAuthConfig(env: NodeJS.ProcessEnv = process.env): SupabaseAuthConfig | null {
  const url = env.STAGEWIRE_SUPABASE_URL;
  const publishableKey = env.STAGEWIRE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey?.trim()) return null;
  const cleanUrl = cleanHostedUrl(url);
  if (!cleanUrl || publishableKey.trim().length < 20) return null;
  return { url: cleanUrl, publishableKey: publishableKey.trim() };
}

export function isSupabaseAuthConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(supabaseAuthConfig(env));
}

async function authFetch(config: SupabaseAuthConfig, path: string, init: RequestInit) {
  return fetch(`${config.url}/auth/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function verifiedUser(config: SupabaseAuthConfig, accessToken: string): Promise<VerifiedExternalIdentity | null> {
  if (!accessToken || accessToken.length > 8_192) return null;
  const response = await authFetch(config, "/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const body = await response.json() as { id?: unknown };
  if (typeof body.id !== "string" || !body.id.trim()) return null;
  return { provider: PROVIDER, subject: body.id.trim() };
}

function accessTokenFromRequest(req: Request) {
  const token = req.body && typeof req.body === "object" && "accessToken" in req.body
    ? (req.body as { accessToken?: unknown }).accessToken
    : null;
  return typeof token === "string" ? token.trim() : "";
}

export function createSupabaseIdentityResolver(config: SupabaseAuthConfig): VerifiedIdentityResolver {
  return async (req) => verifiedUser(config, accessTokenFromRequest(req));
}

function setStageWireSession(res: Response, token: string, expiresAt: string) {
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(process.env.NODE_ENV, expiresAt));
}

export function createSupabaseEmailAuthRouter(config: SupabaseAuthConfig): IRouter {
  const router: IRouter = Router();

  router.post("/auth/email/start", async (req, res, next) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ error: "Enter a valid email address." });
      }

      const response = await authFetch(config, "/otp", {
        method: "POST",
        body: JSON.stringify({ email, create_user: true }),
      });
      if (response.status === 429) {
        return res.status(429).json({ error: "Please wait before requesting another sign-in code." });
      }
      if (!response.ok) {
        return res.status(503).json({ error: "StageWire could not send a sign-in code right now." });
      }
      return res.status(202).json({ sent: true });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/auth/email/verify", async (req, res, next) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!email || email.length > 254 || !EMAIL_PATTERN.test(email) || !OTP_PATTERN.test(token)) {
        return res.status(400).json({ error: "Enter the email and six-digit code exactly as shown." });
      }

      const verification = await authFetch(config, "/verify", {
        method: "POST",
        body: JSON.stringify({ email, token, type: "email" }),
      });
      if (!verification.ok) {
        return res.status(401).json({ error: "That sign-in code is incorrect or expired." });
      }

      const body = await verification.json() as { access_token?: unknown };
      const accessToken = typeof body.access_token === "string" ? body.access_token : "";
      const identity = await verifiedUser(config, accessToken);
      if (!identity) return res.status(401).json({ error: "StageWire could not verify that sign-in." });

      const account = await bootstrapWorkerAccountForIdentity(identity.provider, identity.subject);
      const session = await createWorkerSessionForIdentity(identity.provider, identity.subject);
      if (!session) throw new Error("Verified worker account did not produce a StageWire session.");

      setStageWireSession(res, session.token, session.expiresAt);
      return res.status(account.created ? 201 : 200).json({
        authenticated: true,
        created: account.created,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
