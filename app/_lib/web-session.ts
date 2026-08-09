import { getChatGPTUser } from "../chatgpt-auth";
import type { Permission, WebArea, WebSession } from "./web-platform";

const ownerPermissions: Permission[] = [
  "student:read",
  "coach:work",
  "ops:manage",
  "release:read",
];

export async function getWebSession(): Promise<WebSession> {
  const user = await getChatGPTUser();

  return {
    availableAreas: ["student", "coach", "ops"],
    displayName: user?.displayName ?? "私有预览账号",
    email: user?.email ?? null,
    isPrivatePreview: !user,
    permissions: ownerPermissions,
  };
}

export function canAccessArea(session: WebSession, area: Exclude<WebArea, "public">): boolean {
  const requiredPermission: Record<Exclude<WebArea, "public">, Permission> = {
    coach: "coach:work",
    ops: "ops:manage",
    student: "student:read",
  };

  return session.availableAreas.includes(area) && session.permissions.includes(requiredPermission[area]);
}
