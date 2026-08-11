import { getChatGPTUser } from "../chatgpt-auth";
import type { ChatGPTUser } from "../chatgpt-auth";
import type { Permission, WebArea, WebSession } from "./web-platform";

function configuredEmails(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function createWebSession(
  user: ChatGPTUser | null,
  roleConfiguration: { coachEmails?: string; opsEmails?: string } = {},
): WebSession {
  if (!user) {
    return {
      accountId: null,
      authorizationSource: "anonymous",
      availableAreas: [],
      displayName: "访客",
      email: null,
      isAuthenticated: false,
      permissions: [],
    };
  }

  const coachEmails = configuredEmails(roleConfiguration.coachEmails);
  const opsEmails = configuredEmails(roleConfiguration.opsEmails);
  const permissions: Permission[] = ["student:read"];
  const availableAreas: WebSession["availableAreas"] = ["student"];

  if (coachEmails.has(user.email)) {
    permissions.push("coach:work");
    availableAreas.push("coach");
  }
  if (opsEmails.has(user.email)) {
    permissions.push("ops:manage", "release:read");
    availableAreas.push("ops");
  }

  return {
    accountId: user.id,
    authorizationSource: availableAreas.length > 1 ? "allowlist" : "siwc",
    availableAreas,
    displayName: user.displayName,
    email: user.email,
    isAuthenticated: true,
    permissions,
  };
}

export async function getWebSession(): Promise<WebSession> {
  const user = await getChatGPTUser();
  return createWebSession(user, {
    coachEmails: process.env.ZHUGUANG_COACH_EMAILS,
    opsEmails: process.env.ZHUGUANG_OPS_EMAILS,
  });
}

export function canAccessArea(session: WebSession, area: Exclude<WebArea, "public">): boolean {
  const requiredPermission: Record<Exclude<WebArea, "public">, Permission> = {
    coach: "coach:work",
    ops: "ops:manage",
    student: "student:read",
  };

  return session.availableAreas.includes(area) && session.permissions.includes(requiredPermission[area]);
}
