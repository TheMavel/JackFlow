import {
  SignJWT,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

const SESSION_COOKIE = "jackflow_session";
const USAGE_COOKIE = "jackflow_usage";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const USAGE_TTL_SECONDS = 60 * 60 * 24 * 365;
export const FREE_TRANSCRIPTION_LIMIT = 5;

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};

type UsageState = {
  id: string;
  count: number;
};

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function getGoogleClientId() {
  return envValue(
    "GOOGLE_CLIENT_ID",
    "GOOGLE_Client_ID",
    "GOOGLE_OAUTH_CLIENT_ID",
  );
}

function getGoogleClientSecret() {
  return envValue("GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET");
}

export function isGoogleConfigured() {
  return Boolean(getGoogleClientId());
}

async function signingKey() {
  const secret =
    getGoogleClientSecret() ??
    envValue("SESSION_SECRET", "OPENAI_API_KEY");

  if (!secret) {
    throw new Error("No server-side signing secret is configured.");
  }

  const material = new TextEncoder().encode(`jackflow-session:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return new Uint8Array(digest);
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

function cookie(
  name: string,
  value: string,
  request: Request,
  maxAge: number,
) {
  const secure = new URL(request.url).protocol === "https:";
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(request: Request) {
  return cookie(SESSION_COOKIE, "", request, 0);
}

export async function verifyGoogleCredential(credential: string) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Google login is not configured.");
  }

  const { payload } = await jwtVerify(credential, googleKeys, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });

  if (
    !payload.sub ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new Error("Google account could not be verified.");
  }

  return {
    id: payload.sub,
    email: payload.email,
    name:
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : payload.email.split("@")[0],
    picture:
      typeof payload.picture === "string" ? payload.picture : undefined,
  } satisfies AuthUser;
}

export async function createSessionCookie(user: AuthUser, request: Request) {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer("jackflow")
    .setAudience("jackflow-web")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(await signingKey());

  return cookie(SESSION_COOKIE, token, request, SESSION_TTL_SECONDS);
}

export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, await signingKey(), {
      algorithms: ["HS256"],
      issuer: "jackflow",
      audience: "jackflow-web",
    });

    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture:
        typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export async function getGuestUsage(request: Request): Promise<UsageState> {
  const token = readCookie(request, USAGE_COOKIE);
  if (!token) return { id: crypto.randomUUID(), count: 0 };

  try {
    const { payload } = await jwtVerify(token, await signingKey(), {
      algorithms: ["HS256"],
      issuer: "jackflow",
      audience: "jackflow-guest-usage",
    });
    const count = Number(payload.count);

    return {
      id: payload.sub || crypto.randomUUID(),
      count:
        Number.isFinite(count) && count >= 0
          ? Math.min(Math.floor(count), FREE_TRANSCRIPTION_LIMIT)
          : 0,
    };
  } catch {
    return { id: crypto.randomUUID(), count: 0 };
  }
}

export async function createUsageCookie(
  usage: UsageState,
  request: Request,
) {
  const token = await new SignJWT({ count: usage.count } as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(usage.id)
    .setIssuer("jackflow")
    .setAudience("jackflow-guest-usage")
    .setIssuedAt()
    .setExpirationTime(`${USAGE_TTL_SECONDS}s`)
    .sign(await signingKey());

  return cookie(USAGE_COOKIE, token, request, USAGE_TTL_SECONDS);
}
