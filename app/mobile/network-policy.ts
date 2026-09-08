export const MOBILE_TIMEOUTS = { bootstrap: 10_000, read: 10_000, write: 20_000 } as const;
export function mobileTimeout(path: string, method = "GET") {
  return path.endsWith("/bootstrap") ? MOBILE_TIMEOUTS.bootstrap : method === "GET" ? MOBILE_TIMEOUTS.read : MOBILE_TIMEOUTS.write;
}
export function retryDelay(failures: number) {
  return failures === 0 ? 15_000 : [2_000, 5_000, 15_000, 30_000][Math.min(3, failures - 1)];
}
type Result = { status: string };
type Clock = { set(callback: () => void, delay: number): unknown; clear(id: unknown): void };
export function createRefreshLoop<T extends Result>(task: () => Promise<T>, clock: Clock, isActive: () => boolean = () => true) {
  let inFlight: Promise<T> | null = null;
  let timer: unknown;
  let failures = 0;
  let stopped = false;
  function schedule() {
    clock.clear(timer);
    if (!stopped) timer = clock.set(() => { if (isActive()) void run().catch(() => undefined); else schedule(); }, retryDelay(failures));
  }
  function run(): Promise<T> {
    if (inFlight) return inFlight;
    clock.clear(timer);
    inFlight = Promise.resolve().then(task).then((result) => {
      failures = result.status === "success" ? 0 : failures + 1;
      return result;
    }, (error) => { failures++; throw error; }).finally(() => { inFlight = null; schedule(); });
    return inFlight;
  }
  return { run, start: () => { stopped = false; schedule(); }, stop: () => { stopped = true; clock.clear(timer); } };
}

export async function readMobilePayload(response: Response, signal?: AbortSignal): Promise<{ data?: unknown; error?: { code: string; message: string; requestId: string; fieldErrors?: Record<string,string> } }> {
  const fallback = { error: { code: "invalid_service_response", message: "服务暂时不可用，请稍后重试", requestId: response.headers.get("x-request-id") || "" } };
  if (!response.headers.get("content-type")?.includes("json")) { await response.body?.cancel(); return fallback; }
  const reader = response.body?.getReader();
  const cancel = () => { void reader?.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  let value: unknown;
  try {
    signal?.throwIfAborted();
    const decoder = new TextDecoder(); let text = ''; let size = 0;
    if (reader) while (true) {
      const chunk = await reader.read(); signal?.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4 * 1024 * 1024) { await reader.cancel(); return fallback; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    try { value = JSON.parse(text); } catch { return fallback; }
  } finally { signal?.removeEventListener('abort', cancel); reader?.releaseLock(); }
  if (!value || typeof value !== "object" || (!("data" in value) && !("error" in value))) return fallback;
  if ('error' in value) {
    const error = value.error;
    if (!error || typeof error !== 'object' || !('code' in error) || typeof error.code !== 'string' || !('message' in error) || typeof error.message !== 'string') return fallback;
  }
  return value as typeof fallback;
}

export async function fetchMobilePayload(input: string, init: RequestInit = {}, timeout: number = mobileTimeout(input, init.method), transport: typeof fetch = fetch) {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) abort();
  const timer = globalThis.setTimeout(() => controller.abort(new DOMException('服务响应超时，请重试', 'TimeoutError')), timeout);
  let onAbort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  try {
    controller.signal.throwIfAborted();
    return await Promise.race([interrupted, (async () => {
      const response = await transport(input, { ...init, signal: controller.signal });
      const payload = await readMobilePayload(response, controller.signal);
      return { response, payload };
    })()]);
  } finally {
    globalThis.clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
    void interrupted.catch(() => undefined);
  }
}
