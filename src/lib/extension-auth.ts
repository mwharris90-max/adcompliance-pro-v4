import crypto from "crypto";

const SECRET = process.env.EXTENSION_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

function sign(payload: TokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token: string): TokenPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createExtensionToken(userId: string, email: string): string {
  const now = Date.now();
  return sign({ userId, email, iat: now, exp: now + TOKEN_TTL_MS });
}

export function verifyExtensionToken(token: string): { userId: string; email: string } | null {
  const payload = verify(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email };
}
