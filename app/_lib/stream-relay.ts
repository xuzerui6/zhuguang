const uploadHeaders = ["content-type", "x-file-name", "x-release-version-name", "idempotency-key"];
const responseHeaders = ["content-type", "content-disposition", "content-length", "etag", "x-request-id", "x-content-type-options"];

export async function relayStream(request: Request, url: string, headers: Headers, fetcher: typeof fetch = fetch): Promise<Response> {
  for (const name of uploadHeaders) {
    const value = request.headers.get(name);
    if (!value || (name === "idempotency-key" && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(value))) continue;
    headers.set(name, value);
  }
  const upload = /^(PUT|POST|PATCH)$/u.test(request.method) && !headers.get("content-type")?.includes("json");
  const upstream = await fetcher(url, {
    body: /^(GET|HEAD)$/u.test(request.method) ? undefined : request.body,
    cache: "no-store", headers, method: request.method,
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(upload ? 90_000 : 20_000)]),
    duplex: "half",
  } as RequestInit);
  const outgoing = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff" });
  for (const name of responseHeaders) { const value = upstream.headers.get(name); if (value) outgoing.set(name, value); }
  return new Response(upstream.body, { headers: outgoing, status: upstream.status });
}
