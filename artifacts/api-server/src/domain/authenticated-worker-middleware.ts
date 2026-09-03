import type { Request, RequestHandler } from "express";
import { authenticatedPrincipalForIdentity } from "./worker-identity-map";
import { runWithWorkerPrincipal } from "./worker-context";

export type VerifiedExternalIdentity = {
  provider: string;
  subject: string;
};

export type VerifiedIdentityResolver = (
  request: Request,
) => Promise<VerifiedExternalIdentity | null>;

export function authenticatedWorkerMiddleware(resolveVerifiedIdentity: VerifiedIdentityResolver): RequestHandler {
  return async (req, res, next) => {
    try {
      const externalIdentity = await resolveVerifiedIdentity(req);
      if (!externalIdentity) {
        return res.status(401).json({ error: "Sign in to access your StageWire worker records." });
      }

      const principal = await authenticatedPrincipalForIdentity(
        externalIdentity.provider,
        externalIdentity.subject,
      );
      if (!principal) {
        return res.status(403).json({
          error: "This verified sign-in is not linked to a StageWire worker account yet.",
        });
      }

      return runWithWorkerPrincipal(principal, next);
    } catch (error) {
      return next(error);
    }
  };
}
