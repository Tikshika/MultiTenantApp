import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/admin-session";
import { requireSameOrigin } from "@/lib/admin-request";
import { getDatabasePool } from "@/lib/database";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getSuperAdmin() {
  const account = await getCurrentAdminSession();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (account.must_change_password) {
    return NextResponse.json({ error: "Change your temporary password before continuing." }, { status: 403 });
  }
  if (account.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super admin can manage admin accounts." }, { status: 403 });
  }
  return account;
}

export async function GET() {
  try {
    const account = await getSuperAdmin();
    if (account instanceof Response) return account;

    const pool = getDatabasePool();
    const [accounts, tenants] = await Promise.all([
      pool.query<{
        id: number;
        email: string;
        role: "store_owner" | "super_admin";
        tenant_id: number | null;
        tenant_name: string | null;
        must_change_password: boolean;
        created_at: Date;
      }>(
        `select account.id, account.email, account.role, account.tenant_id,
                tenant.name as tenant_name, account.must_change_password, account.created_at
           from public.admin_accounts as account
           left join public.tenants as tenant on tenant.id = account.tenant_id
          order by account.created_at desc, account.id desc`,
      ),
      pool.query<{ id: number; name: string; slug: string }>(
        "select id, name, slug from public.tenants order by name",
      ),
    ]);

    return NextResponse.json({
      currentAdminId: account.id,
      accounts: accounts.rows,
      tenants: tenants.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load admin accounts.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  let account;
  try {
    account = await getSuperAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the admin session.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (account instanceof Response) return account;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter an email, role, tenant, and temporary password." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Enter valid account details." }, { status: 400 });
  }

  const values = body as Record<string, unknown>;
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
  const role = values.role;
  const tenantId = values.tenantId;
  const temporaryPassword = values.temporaryPassword;

  if (!email || email.length > 254 || !emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (role !== "store_owner" && role !== "super_admin") {
    return NextResponse.json({ error: "Choose a valid admin role." }, { status: 400 });
  }
  if (
    (role === "store_owner" && (!Number.isSafeInteger(tenantId) || Number(tenantId) <= 0)) ||
    (role === "super_admin" && tenantId !== null)
  ) {
    return NextResponse.json({ error: "Choose a tenant for store owners; super admins must not have one." }, { status: 400 });
  }
  if (
    typeof temporaryPassword !== "string" ||
    temporaryPassword.length < 12 ||
    temporaryPassword.length > 1024
  ) {
    return NextResponse.json({ error: "Temporary passwords must be between 12 and 1024 characters." }, { status: 400 });
  }

  try {
    const passwordHash = await hash(temporaryPassword, 12);
    const result = await getDatabasePool().query<{ id: number }>(
      `insert into public.admin_accounts
         (email, password_hash, role, tenant_id, must_change_password)
       values ($1, $2, $3, $4, true)
       returning id`,
      [email, passwordHash, role, tenantId],
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "An admin account with this email already exists." }, { status: 409 });
      }
      if (error.code === "23503") {
        return NextResponse.json({ error: "The selected tenant does not exist." }, { status: 400 });
      }
    }
    const message = error instanceof Error ? error.message : "Could not create the admin account.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
