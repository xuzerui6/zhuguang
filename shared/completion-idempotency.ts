export async function completionIdempotencyKey(id: string, decision: "accepted" | "disputed", note = "") {
  const payload = JSON.stringify({ id, decision, note: note.trim().slice(0, 1000) });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)));
  return `completion-${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
