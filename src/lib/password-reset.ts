import crypto from "crypto";

const RESET_TOKEN_TTL_MINUTES = 30;

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function getBaseUrl(req: Request) {
  if (process.env.NEXTAUTH_URL) {
    return normalizeBaseUrl(process.env.NEXTAUTH_URL);
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = req.headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  const host = req.headers.get("host");
  if (host) {
    return `http://${host}`;
  }

  return "http://localhost:3000";
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(req: Request, token: string, email: string) {
  const url = new URL("/reset-password", getBaseUrl(req));
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}
