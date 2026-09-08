import { ApiError } from "./contracts";

export const BODY_LIMITS = { json: 32_768, avatar: 1_048_576, evidence: 10_485_760, apk: 20_971_520 } as const;

export async function readBoundedBody(request: Request, limit: number): Promise<ArrayBuffer> {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(request.headers.get("content-length")) > limit) {
      await reader.cancel();
      throw new ApiError(413, "payload_too_large", "提交内容超过大小限制");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, "payload_too_large", "提交内容超过大小限制");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes.buffer;
  } finally { reader.releaseLock(); }
}
