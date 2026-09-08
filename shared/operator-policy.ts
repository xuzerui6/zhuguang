// The value is supplied only by trusted server configuration, never by a request.
export function isPrimaryOperator(email: string | null | undefined, configured: string | undefined): boolean {
  const primary=configured?.trim().toLowerCase();
  return Boolean(primary && /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(primary) && email?.trim().toLowerCase()===primary);
}
