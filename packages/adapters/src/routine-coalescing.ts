export function routineTimerNonce(routineId: string, scheduledFor: string): string {
  return `routine-timer:${routineId}:${scheduledFor}`;
}

/** The scheduled occurrence a recurring timer run was created for, if it is one. */
export function routineTimerScheduledFor(
  routineId: string,
  clientNonce: string | null | undefined,
): Date | undefined {
  const prefix = routineTimerNonce(routineId, "");
  if (!clientNonce?.startsWith(prefix)) return undefined;
  const scheduledFor = new Date(clientNonce.slice(prefix.length));
  return Number.isFinite(scheduledFor.getTime()) ? scheduledFor : undefined;
}
