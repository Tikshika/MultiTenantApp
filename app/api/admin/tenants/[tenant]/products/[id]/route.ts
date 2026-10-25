import { NextResponse } from "next/server";
import { authorizeStoreAdmin } from "@/lib/supabase/authorize-admin";
import { getSupabaseAdmin, productImageBucket } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ tenant: string; id: string }>;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function PATCH(request: Request, { params }: RouteProps) {
  const { tenant: tenantSlug, id: idValue } = await params;
  const admin = await authorizeStoreAdmin(tenantSlug);
  if (admin instanceof Response) return admin;

  const productId = Number(idValue);
  if (!/^\d+$/.test(idValue) || !Number.isSafeInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE + 32_768) {
    return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The product form could not be read." }, { status: 400 });
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

  const hasNewImage = image instanceof File && image.size > 0;
  if (image !== null && !(image instanceof File)) {
    return NextResponse.json({ error: "Choose a valid product image." }, { status: 400 });
  }
  if (hasNewImage && image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
  }

  let imagePath: string | null = null;
  let supabase: ReturnType<typeof getSupabaseAdmin> | null = null;
  if (hasNewImage) {
    const extension = IMAGE_TYPES[image.type as keyof typeof IMAGE_TYPES];
    if (!extension) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
    }

    const imageHeader = new Uint8Array(await image.slice(0, 12).arrayBuffer());
    const isPng =
      image.type === "image/png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => imageHeader[index] === byte);
    const isJpeg =
      image.type === "image/jpeg" &&
      imageHeader[0] === 255 &&
      imageHeader[1] === 216 &&
      imageHeader[2] === 255;
    const isWebp =
      image.type === "image/webp" &&
      String.fromCharCode(...imageHeader.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...imageHeader.slice(8, 12)) === "WEBP";
    if (!isPng && !isJpeg && !isWebp) {
      return NextResponse.json(
        { error: "The selected file does not match its declared image type." },
        { status: 415 },
      );
    }

    try {
      supabase = getSupabaseAdmin();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage server configuration is invalid.";
      return NextResponse.json({ error: message }, { status: 503 });
    }

    imagePath = `${tenantSlug}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(productImageBucket)
      .upload(imagePath, image, { contentType: image.type, upsert: false });
    if (uploadError) {
      return NextResponse.json({ error: `Image upload failed: ${uploadError.message}` }, { status: 502 });
    }
  }

  try {
    const currentProduct = await admin.pool.query<{ image_url: string | null }>(
      `select image_url
         from public.products
        where id = $1 and tenant_id = $2 and is_active = true`,
      [productId, admin.tenantId],
    );
    if (currentProduct.rowCount === 0) {
      if (imagePath && supabase) await supabase.storage.from(productImageBucket).remove([imagePath]);
      return NextResponse.json({ error: "Product not found in this store." }, { status: 404 });
    }

    const oldImagePath = currentProduct.rows[0].image_url;
    await admin.pool.query(
      `update public.products
          set name = $1, description = $2, price = $3, stock_qty = $4,
              image_url = coalesce($5, image_url)
        where id = $6 and tenant_id = $7 and is_active = true`,
      [
        name.trim(),
        description.trim() || null,
        price,
        stock,
        imagePath,
        productId,
        admin.tenantId,
      ],
    );

    let warning: string | undefined;
    if (
      imagePath &&
      oldImagePath &&
      !/^https?:\/\//i.test(oldImagePath) &&
      oldImagePath.startsWith(`${tenantSlug}/`) &&
      supabase
    ) {
      const { error: cleanupError } = await supabase.storage.from(productImageBucket).remove([oldImagePath]);
      if (cleanupError) warning = `Product updated, but the previous image could not be removed: ${cleanupError.message}`;
    }

    return NextResponse.json({ id: productId, ...(warning ? { warning } : {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product update failed.";
    if (imagePath && supabase) {
      const { error: cleanupError } = await supabase.storage.from(productImageBucket).remove([imagePath]);
      const cleanupMessage = cleanupError ? ` The uploaded image could not be removed: ${cleanupError.message}` : "";
      return NextResponse.json({ error: `Product could not be updated: ${message}.${cleanupMessage}` }, { status: 502 });
    }
    return NextResponse.json({ error: `Product could not be updated: ${message}.` }, { status: 502 });
  }
}
