import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "stagewire_session";
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  const clean = token.trim();
  if (!clean) throw new Error("StageWire session token cannot be blank.");
  return createHash("sha256").update(clean).digest("hex");
}

export function sessionCookieOptions(nodeEnv: string | undefined, expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: nodeEnv === "production",
    path: "/",
    expires: new Date(expiresAt),
  };
}

export function clearSessionCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: nodeEnv === "production",
    path: "/",
  };
}
