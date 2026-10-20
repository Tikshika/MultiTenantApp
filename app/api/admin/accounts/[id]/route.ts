import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/admin-session";
import { requireSameOrigin } from "@/lib/admin-request";
import { getDatabasePool } from "@/lib/database";

type RouteProps = {
  params: Promise<{ id: string }>;
};

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

function parseAccountId(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  let admin;
  try {
    admin = await getSuperAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the admin session.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (admin instanceof Response) return admin;

  const id = parseAccountId((await params).id);
  if (id === null) return NextResponse.json({ error: "Invalid admin account ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter valid account details." }, { status: 400 });
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
    temporaryPassword !== undefined &&
    (typeof temporaryPassword !== "string" ||
      temporaryPassword.length < 12 ||
      temporaryPassword.length > 1024)
  ) {
    return NextResponse.json({ error: "Temporary passwords must be between 12 and 1024 characters." }, { status: 400 });
  }

  try {
    const passwordHash =
      typeof temporaryPassword === "string" ? await hash(temporaryPassword, 12) : null;
    const pool = getDatabasePool();
    const client = await pool.connect();

    try {
      await client.query("begin");
      const locked = await client.query<{ id: number; role: "store_owner" | "super_admin" }>(
        "select id, role from public.admin_accounts order by id for update",
      );
      const target = locked.rows.find((row) => row.id === id);
      if (!target) {
        await client.query("rollback");
        return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
      }
      if (id === admin.id && role !== "super_admin") {
        await client.query("rollback");
        return NextResponse.json({ error: "You cannot remove your own super admin access." }, { status: 400 });
      }
      if (
        target.role === "super_admin" &&
        role !== "super_admin" &&
        locked.rows.filter((row) => row.role === "super_admin").length <= 1
      ) {
        await client.query("rollback");
        return NextResponse.json({ error: "The last super admin cannot be demoted." }, { status: 409 });
      }

      await client.query(
        `update public.admin_accounts
            set email = $1,
                role = $2,
                tenant_id = $3,
                password_hash = coalesce($4, password_hash),
                must_change_password = case when $4 is null then must_change_password else true end,
                password_changed_at = case when $4 is null then password_changed_at else now() end
          where id = $5`,
        [email, role, tenantId, passwordHash, id],
      );
      if (passwordHash) {
        await client.query("delete from public.admin_sessions where admin_account_id = $1", [id]);
      }
      await client.query("commit");
      return NextResponse.json({ ok: true, passwordReset: Boolean(passwordHash) });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "An admin account with this email already exists." }, { status: 409 });
      }
      if (error.code === "23503") {
        return NextResponse.json({ error: "The selected tenant does not exist." }, { status: 400 });
      }
    }
    const message = error instanceof Error ? error.message : "Could not update the admin account.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  let admin;
  try {
    admin = await getSuperAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the admin session.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (admin instanceof Response) return admin;

  const id = parseAccountId((await params).id);
  if (id === null) return NextResponse.json({ error: "Invalid admin account ID." }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });
  }

  try {
    const client = await getDatabasePool().connect();
    try {
      await client.query("begin");
      const locked = await client.query<{ id: number; role: "store_owner" | "super_admin" }>(
        "select id, role from public.admin_accounts order by id for update",
      );
      const target = locked.rows.find((row) => row.id === id);
      if (!target) {
        await client.query("rollback");
        return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
      }
      if (
        target.role === "super_admin" &&
        locked.rows.filter((row) => row.role === "super_admin").length <= 1
      ) {
        await client.query("rollback");
        return NextResponse.json({ error: "The last super admin cannot be deleted." }, { status: 409 });
      }

      await client.query("delete from public.admin_accounts where id = $1", [id]);
      await client.query("commit");
      return NextResponse.json({ ok: true });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the admin account.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
