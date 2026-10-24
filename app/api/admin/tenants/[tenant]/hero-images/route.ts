import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/admin-request";
import { authorizeStoreAdmin } from "@/lib/supabase/authorize-admin";
import { getSupabaseAdmin, productImageBucket } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ tenant: string }>;
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_HERO_IMAGES = 10;
const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", matches: (header: Uint8Array) => header[0] === 255 && header[1] === 216 && header[2] === 255 },
  "image/png": {
    extension: "png",
    matches: (header: Uint8Array) => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte),
  },
  "image/webp": {
    extension: "webp",
    matches: (header: Uint8Array) =>
      String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...header.slice(8, 12)) === "WEBP",
  },
} as const;

type HeroImageRow = {
  id: number;
  image_path: string;
  position: number;
  created_at: Date;
};

async function getSignedImages(
  rows: HeroImageRow[],
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  return Promise.all(
    rows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from(productImageBucket)
        .createSignedUrl(row.image_path, 60 * 60);
      if (error) throw new Error(`Could not create an image URL: ${error.message}`);
      return {
        id: row.id,
        position: row.position,
        created_at: row.created_at,
        image_url: data.signedUrl,
      };
    }),
  );
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { tenant } = await params;
  const admin = await authorizeStoreAdmin(tenant);
  if (admin instanceof Response) return admin;

  try {
    const [result, supabase] = await Promise.all([
      admin.pool.query<HeroImageRow>(
        `select id, image_path, position, created_at
           from public.tenant_hero_images
          where tenant_id = $1
          order by position, id`,
        [admin.tenantId],
      ),
      Promise.resolve(getSupabaseAdmin()),
    ]);
    return NextResponse.json({ images: await getSignedImages(result.rows, supabase) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load hero images.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { tenant } = await params;
  const admin = await authorizeStoreAdmin(tenant);
  if (admin instanceof Response) return admin;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE + 32_768) {
    return NextResponse.json({ error: "Each hero image must be 4 MB or smaller." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The image upload could not be read." }, { status: 400 });
  }
  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Hero images must be between 1 byte and 4 MB." }, { status: 413 });
  }

  const imageType = IMAGE_TYPES[image.type as keyof typeof IMAGE_TYPES];
  if (!imageType) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  }
  const header = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  if (!imageType.matches(header)) {
    return NextResponse.json({ error: "The selected file does not match its declared image type." }, { status: 415 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage server configuration is invalid.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const client = await admin.pool.connect();
  let imagePath: string | null = null;
  try {
    await client.query("begin");
    const tenant = await client.query(
      "select id from public.tenants where id = $1 for update",
      [admin.tenantId],
    );
    if (!tenant.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }
    const { rows } = await client.query<{ count: string; next_position: number }>(
      `select count(*)::text as count, coalesce(max(position), -1) + 1 as next_position
         from public.tenant_hero_images
        where tenant_id = $1`,
      [admin.tenantId],
    );
    if (Number(rows[0].count) >= MAX_HERO_IMAGES) {
      await client.query("rollback");
      return NextResponse.json({ error: `A store can have up to ${MAX_HERO_IMAGES} hero images.` }, { status: 409 });
    }

    imagePath = `${tenant}/hero/${crypto.randomUUID()}.${imageType.extension}`;
    const { error: uploadError } = await supabase.storage
      .from(productImageBucket)
      .upload(imagePath, image, { contentType: image.type, upsert: false });
    if (uploadError) {
      await client.query("rollback");
      const detail = /row-level security policy/i.test(uploadError.message)
        ? " Check that SUPABASE_SERVICE_ROLE_KEY is a Supabase secret/service_role key, not the publishable/anon key."
        : "";
      return NextResponse.json({ error: `Image upload failed: ${uploadError.message}.${detail}` }, { status: 502 });
    }

    const inserted = await client.query<HeroImageRow>(
      `insert into public.tenant_hero_images (tenant_id, image_path, position)
       values ($1, $2, $3)
       returning id, image_path, position, created_at`,
      [admin.tenantId, imagePath, rows[0].next_position],
    );
    await client.query("commit");
    return NextResponse.json({ id: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    await client.query("rollback");
    const cleanupMessage = imagePath
      ? await supabase.storage.from(productImageBucket).remove([imagePath]).then(({ error: cleanupError }) =>
          cleanupError ? ` Uploaded file cleanup failed: ${cleanupError.message}` : "",
        )
      : "";
    const message = error instanceof Error ? error.message : "Could not save the hero image.";
    return NextResponse.json({ error: `${message}${cleanupMessage}` }, { status: 502 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { tenant } = await params;
  const admin = await authorizeStoreAdmin(tenant);
  if (admin instanceof Response) return admin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Provide the ordered hero image IDs." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("imageIds" in body) || !Array.isArray(body.imageIds)) {
    return NextResponse.json({ error: "Provide the ordered hero image IDs." }, { status: 400 });
  }
  const imageIds: unknown[] = body.imageIds;
  if (imageIds.length > MAX_HERO_IMAGES || !imageIds.every((id) => Number.isSafeInteger(id) && Number(id) > 0)) {
    return NextResponse.json({ error: "The hero image order is invalid." }, { status: 400 });
  }

  const client = await admin.pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query<{ id: number }>(
      "select id from public.tenant_hero_images where tenant_id = $1 order by position, id for update",
      [admin.tenantId],
    );
    const ids = imageIds as number[];
    if (
      existing.rows.length !== ids.length ||
      new Set(ids).size !== ids.length ||
      existing.rows.some((row) => !ids.includes(row.id))
    ) {
      await client.query("rollback");
      return NextResponse.json({ error: "The hero image list changed. Reload and try again." }, { status: 409 });
    }

    for (const [position, id] of ids.entries()) {
      await client.query(
        "update public.tenant_hero_images set position = $1 where tenant_id = $2 and id = $3",
        [position, admin.tenantId, id],
      );
    }
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Could not reorder hero images.";
    return NextResponse.json({ error: message }, { status: 503 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { tenant } = await params;
  const admin = await authorizeStoreAdmin(tenant);
  if (admin instanceof Response) return admin;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Choose a valid hero image." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await admin.pool.query<{ image_path: string }>(
      "select image_path from public.tenant_hero_images where tenant_id = $1 and id = $2",
      [admin.tenantId, id],
    );
    const image = result.rows[0];
    if (!image) return NextResponse.json({ error: "Hero image not found." }, { status: 404 });

    const { error: removeError } = await supabase.storage.from(productImageBucket).remove([image.image_path]);
    if (removeError) {
      return NextResponse.json({ error: `Could not remove image from storage: ${removeError.message}` }, { status: 502 });
    }
    await admin.pool.query(
      "delete from public.tenant_hero_images where tenant_id = $1 and id = $2",
      [admin.tenantId, id],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the hero image.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
