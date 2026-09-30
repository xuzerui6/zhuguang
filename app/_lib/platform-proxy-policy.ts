const publicPatterns = [
  /^\/api\/v1\/public\/legal-documents$/u,
  /^\/api\/v1\/coaches(?:\/\d+\/(?:booking-options|reviews|slots)|\/\d+)?(?:\?.*)?$/u,
  /^\/api\/v1\/health$/u,
  /^\/api\/v1\/(?:capabilities|catalog|public\/trust-metrics)(?:\?.*)?$/u,
];

export function allowedForPlatformSession(path: string, method: string, permissions: string[]) {
  if (publicPatterns.some((pattern) => pattern.test(path))) return method === "GET";
  if (path === "/api/v1/telemetry/events") return method === "POST";
  if (path === "/api/v1/service-leads") return method === "POST";
  if (path === "/api/v1/partnership-leads") return method === "POST";
  if (path === "/api/v1/privacy-requests") return method === "POST";
  if (path.startsWith("/api/v1/operator/")) return permissions.includes("ops:manage");
  if (path.startsWith("/api/v1/coach/")) return permissions.includes("coach:work");
  return permissions.includes("student:read") && /^\/api\/v1\/(?:bootstrap|booking-completion-requests|bookings|coach-applications|conversations|favorites|learner-profiles|me|notifications|payment-orders|refund-requests|reschedule-proposals|reviews|support-tickets|training-records)(?:\/.*)?(?:\?.*)?$/u.test(path);
}
