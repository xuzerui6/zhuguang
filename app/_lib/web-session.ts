import { cookies, headers } from "next/headers";
import { getChatGPTUser } from "../chatgpt-auth";
import type { ChatGPTUser } from "../chatgpt-auth";
import { verifyCloudflareAccessToken } from "./cloudflare-access";
import type { Permission, WebArea, WebSession } from "./web-platform";

export const WEB_ACCESS_COOKIE = "zg_web_access";
export const WEB_REFRESH_COOKIE = "zg_web_refresh";
export const WEB_CONTACT_COOKIE = "zg_web_contact";

type MobileIdentity = {
  availableModes?: Array<"student" | "coach">;
  contactMasked?: string;
  email?: string;
  phoneMasked?: string;
  roles?: Array<"student" | "coach" | "operator">;
  userId?: string;
};

const PRIMARY_OPERATOR_EMAIL = "xuzerui6@gmail.com";

function configuredEmails(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function sessionFromChatGPT(
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
  const permissions: Permission[] = ["student:read"];
  const availableAreas: WebSession["availableAreas"] = ["student"];
  if (coachEmails.has(user.email)) {
    permissions.push("coach:work");
    availableAreas.push("coach");
  }
  if (user.email.trim().toLowerCase() === PRIMARY_OPERATOR_EMAIL) {
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

async function mobileIdentityFromCookie(): Promise<MobileIdentity | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(WEB_ACCESS_COOKIE)?.value;
  const appKey = process.env.ZHUGUANG_PILOT_APP_KEY;
  if (!accessToken || !appKey) return null;
  const baseUrl = (process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "");
  try {
    const response = await fetch(`${baseUrl}/api/v1/me`, {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-device-id": "zhuguang-web",
        "x-zhuguang-app-key": appKey,
      },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { data?: MobileIdentity };
    return payload.data ?? null;
  } catch {
    return null;
  }
}

async function cloudflareAccessUser(): Promise<ChatGPTUser | null> {
  const audience = process.env.CF_ACCESS_AUD;
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
  if (!audience || !teamDomain) return null;
  const requestHeaders = await headers();
  const token = requestHeaders.get("cf-access-jwt-assertion");
  if (!token) return null;
  const identity = await verifyCloudflareAccessToken(token, { audience, teamDomain });
  if (!identity) return null;
  return {
    displayName: identity.name || identity.email,
    email: identity.email,
    fullName: identity.name || null,
    id: identity.subject,
  };
}

export function createWebSession(
  user: ChatGPTUser | null,
  roleConfiguration: { coachEmails?: string; opsEmails?: string } = {},
): WebSession {
  return sessionFromChatGPT(user, roleConfiguration);
}

export async function getWebSession(): Promise<WebSession> {
  const identity = await mobileIdentityFromCookie();
  if (identity?.userId) {
    const roles = new Set(identity.roles ?? ["student"]);
    const availableAreas: WebSession["availableAreas"] = ["student"];
    const permissions: Permission[] = ["student:read"];
    if (roles.has("coach") && identity.availableModes?.includes("coach")) {
      availableAreas.push("coach");
      permissions.push("coach:work");
    }
    const email = identity.email?.trim().toLowerCase() || null;
    if (roles.has("operator") && email === PRIMARY_OPERATOR_EMAIL) {
      availableAreas.push("ops");
      permissions.push("ops:manage", "release:read");
    }
    return {
      accountId: identity.userId,
      authorizationSource: "email",
      availableAreas,
      displayName: identity.contactMasked || identity.phoneMasked || "逐光用户",
      email,
      isAuthenticated: true,
      permissions,
    };
  }
  const roleConfiguration = {
    coachEmails: process.env.ZHUGUANG_COACH_EMAILS,
    opsEmails: process.env.ZHUGUANG_OPS_EMAILS,
  };
  if (process.env.CF_ACCESS_ENABLED === "true") {
    const accessUser = await cloudflareAccessUser();
    const session = sessionFromChatGPT(accessUser, roleConfiguration);
    return accessUser ? { ...session, authorizationSource: session.availableAreas.length > 1 ? "allowlist" : "access" } : session;
  }
  return sessionFromChatGPT(await getChatGPTUser(), roleConfiguration);
}

export function canAccessArea(session: WebSession, area: Exclude<WebArea, "public">): boolean {
  const requiredPermission: Record<Exclude<WebArea, "public">, Permission> = {
    coach: "coach:work",
    ops: "ops:manage",
    student: "student:read",
  };
  return session.availableAreas.includes(area) && session.permissions.includes(requiredPermission[area]);
}
