import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { findUserById, DbUser } from "./db";

export { ROLES } from "./db";
export type { Role } from "./db";

export const SESSION_COOKIE = "tms_session";

// Set AUTH_SECRET in .env for production. The fallback is only for local dev.
const SECRET = process.env.AUTH_SECRET || "tms-dev-secret-change-me";

const sign = (value: string) =>
  crypto.createHmac("sha256", SECRET).update(value).digest("hex");

export const createSessionToken = (userId: number) =>
  `${userId}.${sign(String(userId))}`;

const verifySessionToken = (token?: string): number | null => {
  if (!token) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(id));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
};

/** Returns the logged-in user (fresh from Postgres, so role changes/deletes apply instantly). */
export const getSessionUser = async (req: NextRequest): Promise<DbUser | null> => {
  const id = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (id === null) return null;
  return findUserById(id);
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV === "production",
};

/** Admin-only guard for API routes. `error` is a ready-made response when access is denied. */
export const requireAdmin = async (req: NextRequest) => {
  const me = await getSessionUser(req);
  if (!me) {
    return { error: NextResponse.json({ error: "Not logged in" }, { status: 401 }), me: null };
  }
  if (me.role !== "admin") {
    return { error: NextResponse.json({ error: "Admins only" }, { status: 403 }), me: null };
  }
  return { error: null, me };
};
