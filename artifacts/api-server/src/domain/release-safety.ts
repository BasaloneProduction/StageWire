export const AUTH_REQUIRED_MESSAGE =
  'StageWire API will not start outside development or test until worker authentication is implemented. This protects worker records from being exposed through an unauthenticated shared deployment.';

export function assertReleaseSafety(nodeEnv: string | undefined) {
  if (nodeEnv === 'development' || nodeEnv === 'test') return;
  throw new Error(AUTH_REQUIRED_MESSAGE);
}
