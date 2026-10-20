import { compare, hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { requireSameOrigin } from "@/lib/admin-request";
import { getDatabasePool } from "@/lib/database";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Sign in to change your password." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your current and new passwords." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("currentPassword" in body) || !("newPassword" in body)) {
    return NextResponse.json({ error: "Enter your current and new passwords." }, { status: 400 });
  }

  const { currentPassword, newPassword } = body as { currentPassword: unknown; newPassword: unknown };
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    currentPassword.length > 1024 ||
    newPassword.length < 12 ||
    newPassword.length > 1024
  ) {
    return NextResponse.json({ error: "Use a new password with at least 12 characters." }, { status: 400 });
  }

  try {
    const pool = getDatabasePool();
    const sessionHash = createHash("sha256").update(sessionToken).digest("hex");
    const result = await pool.query<{
      id: number;
      password_hash: string;
      must_change_password: boolean;
    }>(
      `select account.id, account.password_hash, account.must_change_password
         from public.admin_sessions as session
         join public.admin_accounts as account on account.id = session.admin_account_id
        where session.token_hash = $1 and session.expires_at > now()
        limit 1`,
      [sessionHash],
    );
    const account = result.rows[0];

    if (!account) {
      return NextResponse.json({ error: "Your admin session has expired. Sign in again." }, { status: 401 });
    }

    if (!account.must_change_password && !(await compare(currentPassword, account.password_hash))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
    }

    if (await compare(newPassword, account.password_hash)) {
      return NextResponse.json({ error: "Choose a different password from your current one." }, { status: 400 });
    }

    const passwordHash = await hash(newPassword, 12);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `update public.admin_accounts
            set password_hash = $1,
                must_change_password = false,
                password_changed_at = now()
          where id = $2`,
        [passwordHash, account.id],
      );
      await client.query("delete from public.admin_sessions where admin_account_id = $1", [account.id]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password update failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
