import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/database";
import { getTenantDatabaseId } from "@/lib/tenant-config";
import { getTenantBySlug } from "@/lib/tenant-data";
import { getSupabaseAdmin, productImageBucket } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ tenant: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { tenant: tenantSlug } = await params;
  const storefront = getTenantBySlug(tenantSlug);
  if (!storefront) {
    return NextResponse.json({ error: "This store is not configured in the application." }, { status: 404 });
  }

  try {
    const tenantId = getTenantDatabaseId(tenantSlug);
    if (tenantId === undefined) {
      return NextResponse.json({ error: "This store has no database ID configured." }, { status: 500 });
    }
    const pool = getDatabasePool();
    const tenant = await pool.query(
      "select id from public.tenants where id = $1 and slug = $2 limit 1",
      [tenantId, storefront.slug],
    );
    if (!tenant.rows[0]) {
      return NextResponse.json({ error: "Configured store does not match a database tenant." }, { status: 404 });
    }

    const result = await pool.query<{ id: number; image_path: string; position: number }>(
      `select id, image_path, position
         from public.tenant_hero_images
        where tenant_id = $1
        order by position, id`,
      [tenantId],
    );
    const supabase = getSupabaseAdmin();
    const images = await Promise.all(result.rows.map(async (image) => {
      const { data, error } = await supabase.storage
        .from(productImageBucket)
        .createSignedUrl(image.image_path, 60 * 60);
      if (error) throw new Error(`Could not create a hero image URL: ${error.message}`);
      return { id: image.id, position: image.position, image_url: data.signedUrl };
    }));
    return NextResponse.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load storefront hero images.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
