import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const PREFIX = "scrypt$";

export const isHashed = (stored: string) => stored.startsWith(PREFIX);

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${PREFIX}${salt}$${hash.toString("hex")}`;
}

const safeEqual = (a: Buffer, b: Buffer) =>
  a.length === b.length && crypto.timingSafeEqual(a, b);

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isHashed(stored)) {
    const [, salt, hash] = stored.split("$");
    if (!salt || !hash) return false;
    const test = await scrypt(password, salt, 64);
    return safeEqual(test, Buffer.from(hash, "hex"));
  }
  // Legacy plain-text row (e.g. inserted by hand). Login upgrades it to a hash.
  return safeEqual(Buffer.from(password), Buffer.from(stored));
}
