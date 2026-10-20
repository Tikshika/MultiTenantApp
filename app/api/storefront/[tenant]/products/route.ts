import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDatabasePool } from "@/lib/database";
import { getTenantDatabaseId } from "@/lib/tenant-config";
import { getActiveProducts } from "@/lib/supabase/products";
import { getTenantBySlug } from "@/lib/tenant-data";

type RouteProps = {
  params: Promise<{ tenant: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { tenant: tenantSlug } = await params;
  const storefront = getTenantBySlug(tenantSlug);

  if (!storefront) {
    return NextResponse.json({ error: "This store is not configured in the application." }, { status: 404 });
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

  let supabase;
  let pool;
  try {
    supabase = getSupabaseAdmin();
    pool = getDatabasePool();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration is invalid.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const tenant = await pool.query<{ id: number }>(
      "select id from public.tenants where id = $1 and slug = $2 limit 1",
      [tenantId, storefront.slug],
    );
    if (!tenant.rows[0]) {
      return NextResponse.json(
        { error: `Configured store ID ${tenantId} does not match a database tenant.` },
        { status: 404 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load store details.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const products = await getActiveProducts(pool, supabase, tenantId);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load products.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
