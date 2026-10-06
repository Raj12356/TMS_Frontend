import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../lib/auth";
import { findUserByEmail, updateUserPassword } from "../../../lib/db";
import { hashPassword, isHashed, verifyPassword } from "../../../lib/password";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const foundUser =
      email && password ? await findUserByEmail(String(email).trim()) : null;

    if (!foundUser || !(await verifyPassword(String(password), foundUser.password))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // upgrade any legacy plain-text password to a hash
    if (!isHashed(foundUser.password)) {
      await updateUserPassword(foundUser.id, await hashPassword(String(password)));
    }

    const { password: _, ...userWithoutPassword } = foundUser;

    const res = NextResponse.json({ user: userWithoutPassword });
    res.cookies.set(SESSION_COOKIE, createSessionToken(foundUser.id), sessionCookieOptions);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
