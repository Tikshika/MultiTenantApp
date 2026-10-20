import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/admin-session";
import { getDatabasePool } from "@/lib/database";
import { getTenantDatabaseId } from "@/lib/tenant-config";
import { getTenantBySlug } from "@/lib/tenant-data";

export async function authorizeStoreAdmin(tenantSlug: string) {
  const storefront = getTenantBySlug(tenantSlug);

  if (!storefront) {
    return NextResponse.json({ error: "This store is not configured in the application." }, { status: 404 });
  }

  let account;
  let pool;
  try {
    account = await getCurrentAdminSession();
    pool = getDatabasePool();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the admin session.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!account) {
    return NextResponse.json({ error: "Sign in with an admin account to continue." }, { status: 401 });
  }

  if (account.must_change_password) {
    return NextResponse.json({ error: "Change the temporary password before managing products." }, { status: 403 });
  }

  let tenantId: number;
  try {
    const configuredTenantId = getTenantDatabaseId(tenantSlug);
    if (configuredTenantId === undefined) {
      return NextResponse.json({ error: "This store has no database ID configured." }, { status: 500 });
    }
    tenantId = configuredTenantId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tenant database ID configuration is invalid.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const result = await pool.query<{ id: number }>(
      "select id from public.tenants where id = $1 and slug = $2 limit 1",
      [tenantId, storefront.slug],
    );
    if (!result.rows[0]) {
      return NextResponse.json(
        { error: `Configured store ID ${tenantId} does not match a database tenant.` },
        { status: 404 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load this store from the database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (account.role !== "super_admin" && account.tenant_id !== tenantId) {
    return NextResponse.json(
      { error: "This account cannot manage this store." },
      { status: 403 },
    );
  }

  return { account, pool, tenantId };
}
