export const AUTH_REQUIRED_MESSAGE =
  "StageWire API will not start outside development or test until verified worker authentication is configured. This protects worker records from being exposed through an unauthenticated shared deployment.";

export function assertReleaseSafety(nodeEnv: string | undefined, verifiedAuthConfigured = false) {
  if (nodeEnv === "development" || nodeEnv === "test") return;
  if (verifiedAuthConfigured) return;
  throw new Error(AUTH_REQUIRED_MESSAGE);
}
