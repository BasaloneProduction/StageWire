import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function expectedHost(requestHost: string | undefined) {
  const configured = process.env.STAGEWIRE_PUBLIC_ORIGIN?.trim();
  if (!configured) return requestHost?.trim().toLowerCase() || null;
  try {
    return new URL(configured).host.toLowerCase();
  } catch {
    throw new Error("STAGEWIRE_PUBLIC_ORIGIN must be a valid absolute URL.");
  }
}

export function sameOriginWriteGuard(): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

    const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
    if (fetchSite === "cross-site") {
      return res.status(403).json({ error: "Cross-site API writes are not allowed." });
    }

    const origin = req.get("origin")?.trim();
    if (!origin) return next();

    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return res.status(403).json({ error: "Cross-site API writes are not allowed." });
    }

    const host = expectedHost(req.get("host"));
    if (!host || originHost !== host) {
      return res.status(403).json({ error: "Cross-site API writes are not allowed." });
    }

    return next();
  };
}
