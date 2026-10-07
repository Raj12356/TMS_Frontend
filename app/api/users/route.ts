import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../lib/auth";
import { listUsers, createUser, findUserByEmail, isUniqueViolation } from "../../../lib/db";
import { hashPassword } from "../../../lib/password";

// GET - list users (passwords are never returned). Optionally filter by ?role=manager
export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get("role");
    const users = await listUsers();
    const filtered = role ? users.filter((u) => u.role === role) : users;
    return NextResponse.json(filtered);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST - public registration. Every new account is ALWAYS a default "user".
// Any role sent by the client is ignored; only an admin can change roles later.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    let newUser;
    try {
      newUser = await createUser(name, email, await hashPassword(password));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
      }
      throw err;
    }

    const res = NextResponse.json({ user: newUser });
    res.cookies.set(SESSION_COOKIE, createSessionToken(newUser.id), sessionCookieOptions);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
