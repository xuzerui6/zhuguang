export type PageRecoveryState = 'recovering' | 'succeeded' | 'failed';

export async function recoverPageSession(request: Promise<boolean>, update: (state: PageRecoveryState) => void, navigate: () => void, signal: AbortSignal) {
  const ok = await request.catch(() => false);
  if (signal.aborted) return;
  update(ok ? 'succeeded' : 'failed');
  if (ok) navigate();
}
