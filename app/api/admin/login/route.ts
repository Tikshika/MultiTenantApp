import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSession } from "@/lib/admin-session";
import { requireSameOrigin } from "@/lib/admin-request";
import { getDatabasePool } from "@/lib/database";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const { email, password } = body as { email: unknown; password: unknown };
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 1024 ||
    !email.trim()
  ) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    const result = await getDatabasePool().query<{
      id: number;
      email: string;
      password_hash: string;
      must_change_password: boolean;
    }>(
      `select id, email, password_hash, must_change_password
         from public.admin_accounts
        where lower(email) = lower($1)
        limit 1`,
      [email.trim()],
    );
    const account = result.rows[0];

    if (!account || !(await compare(password, account.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createAdminSession(account.id);
    const response = NextResponse.json({
      email: account.email,
      mustChangePassword: account.must_change_password,
    });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin sign-in failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
