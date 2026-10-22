// Firma y verificación del token de sesión (compatible con el runtime Edge del middleware).
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "sf_session";
export const SESSION_HOURS = 12;

export interface SessionPayload {
  sub: string;
  role: string;
  name: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET no está configurado (mínimo 32 caracteres).");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: String(payload.role ?? ""), name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
