export const webSecurityHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://beijingzhuguang.top https://api.beijingzhuguang.top; connect-src 'self' https://api.beijingzhuguang.top https://challenges.cloudflare.com https://cloudflareinsights.com; frame-src https://challenges.cloudflare.com; font-src 'self' data:; manifest-src 'self'; upgrade-insecure-requests" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
] as const;

export function applyWebSecurityHeaders(headers: Headers) {
  for (const { key, value } of webSecurityHeaders) headers.set(key, value);
  return headers;
}
