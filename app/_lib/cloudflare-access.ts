import { createRemoteJWKSet, jwtVerify } from "jose";

type AccessConfig = {
  audience: string;
  teamDomain: string;
};

type AccessIdentity = {
  email: string;
  name?: string;
  subject: string;
};

const remoteKeySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizedTeamDomain(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Cloudflare Access team domain must use HTTPS");
  return url.origin;
}

function remoteKeySet(teamDomain: string) {
  let keySet = remoteKeySets.get(teamDomain);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    remoteKeySets.set(teamDomain, keySet);
  }
  return keySet;
}

export async function verifyCloudflareAccessToken(
  token: string,
  config: AccessConfig,
  verificationKey?: CryptoKey,
): Promise<AccessIdentity | null> {
  try {
    const teamDomain = normalizedTeamDomain(config.teamDomain);
    const { payload } = await jwtVerify(token, verificationKey ?? remoteKeySet(teamDomain), {
      audience: config.audience,
      issuer: teamDomain,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@") || typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      email,
      name: typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : undefined,
      subject: payload.sub,
    };
  } catch {
    return null;
  }
}
