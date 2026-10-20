import { NextResponse } from "next/server";
import { authorizeStoreAdmin } from "@/lib/supabase/authorize-admin";
import { getSupabaseAdmin, productImageBucket } from "@/lib/supabase/admin";
import { getActiveProducts } from "@/lib/supabase/products";

type RouteProps = {
  params: Promise<{ tenant: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { tenant: tenantSlug } = await params;
  const admin = await authorizeStoreAdmin(tenantSlug);

  if (admin instanceof Response) return admin;

  try {
    const supabase = getSupabaseAdmin();
    const products = await getActiveProducts(admin.pool, supabase, admin.tenantId);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load products.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: Request, { params }: RouteProps) {
  const { tenant: tenantSlug } = await params;
  const admin = await authorizeStoreAdmin(tenantSlug);

  if (admin instanceof Response) return admin;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE + 32_768) {
    return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload form could not be read." }, { status: 400 });
  }

  const name = formData.get("name");
  const description = formData.get("description");
  const priceValue = formData.get("price");
  const stockValue = formData.get("stock");
  const price = typeof priceValue === "string" ? Number(priceValue) : Number.NaN;
  const stock = typeof stockValue === "string" ? Number(stockValue) : Number.NaN;
  const image = formData.get("image");

  if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
    return NextResponse.json({ error: "Enter a product name of 1 to 150 characters." }, { status: 400 });
  }

  if (typeof description !== "string" || description.length > 2000) {
    return NextResponse.json({ error: "Product descriptions must be 2,000 characters or fewer." }, { status: 400 });
  }

  if (
    typeof priceValue !== "string" ||
    !/^\d+(?:\.\d{1,2})?$/.test(priceValue) ||
    !Number.isFinite(price) ||
    price > 9_999_999_999.99
  ) {
    return NextResponse.json({ error: "Enter a valid non-negative price." }, { status: 400 });
  }

  if (
    typeof stockValue !== "string" ||
    !/^\d+$/.test(stockValue) ||
    !Number.isInteger(stock) ||
    stock > 2_147_483_647
  ) {
    return NextResponse.json({ error: "Enter a valid non-negative stock quantity." }, { status: 400 });
  }

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Choose a product image to upload." }, { status: 400 });
  }

  if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Images must be between 1 byte and 5 MB." }, { status: 413 });
  }

  const extension = IMAGE_TYPES[image.type as keyof typeof IMAGE_TYPES];
  if (!extension) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  }

  const imageHeader = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  const isPng =
    image.type === "image/png" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => imageHeader[index] === byte);
  const isJpeg = image.type === "image/jpeg" && imageHeader[0] === 255 && imageHeader[1] === 216 && imageHeader[2] === 255;
  const isWebp =
    image.type === "image/webp" &&
    String.fromCharCode(...imageHeader.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...imageHeader.slice(8, 12)) === "WEBP";

  if (!isPng && !isJpeg && !isWebp) {
    return NextResponse.json({ error: "The selected file does not match its declared image type." }, { status: 415 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage server configuration is invalid.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const imagePath = `${tenantSlug}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(productImageBucket)
    .upload(imagePath, image, { contentType: image.type, upsert: false });

  if (uploadError) {
    const isPolicyError = /row-level security policy/i.test(uploadError.message);
    const detail = isPolicyError
      ? " Check that SUPABASE_SERVICE_ROLE_KEY is a Supabase secret/service_role key, not the publishable/anon key."
      : "";
    return NextResponse.json(
      { error: `Image upload failed: ${uploadError.message}.${detail}` },
      { status: 502 },
    );
  }

  try {
    const product = await admin.pool.query<{ id: number }>(
      `insert into public.products
         (tenant_id, name, description, price, stock_qty, image_url, is_active)
       values ($1, $2, $3, $4, $5, $6, true)
       returning id`,
      [admin.tenantId, name.trim(), description.trim() || null, price, stock, imagePath],
    );

    return NextResponse.json({ id: product.rows[0].id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product database insert failed.";
    const { error: cleanupError } = await supabase.storage.from(productImageBucket).remove([imagePath]);
    const cleanupMessage = cleanupError ? ` The uploaded file could not be removed: ${cleanupError.message}` : "";
    return NextResponse.json(
      { error: `Product could not be saved: ${message}.${cleanupMessage}` },
      { status: 502 },
    );
  }
}
