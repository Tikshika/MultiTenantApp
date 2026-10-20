import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabasePool } from "@/lib/database";

export const ADMIN_SESSION_COOKIE = "retail_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type AdminAccount = {
  id: number;
  email: string;
  role: "store_owner" | "super_admin";
  tenant_id: number | null;
  must_change_password: boolean;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(accountId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const pool = getDatabasePool();

  await pool.query("delete from public.admin_sessions where expires_at <= now()");
  await pool.query(
    `insert into public.admin_sessions (token_hash, admin_account_id, expires_at)
     values ($1, $2, now() + ($3 * interval '1 second'))`,
    [tokenHash, accountId, ADMIN_SESSION_MAX_AGE],
  );

  return token;
}

export async function getCurrentAdminSession() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const pool = getDatabasePool();
  const tokenHash = hashSessionToken(token);
  const result = await pool.query<AdminAccount>(
    `select account.id, account.email, account.role, account.tenant_id, account.must_change_password
       from public.admin_sessions as session
       join public.admin_accounts as account on account.id = session.admin_account_id
      where session.token_hash = $1 and session.expires_at > now()
      limit 1`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function revokeAdminSession(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;

  await getDatabasePool().query("delete from public.admin_sessions where token_hash = $1", [
    hashSessionToken(token),
  ]);
}
