import type { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productImageBucket } from "@/lib/supabase/admin";

type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock_qty: number;
  image_url: string | null;
};

export async function getActiveProducts(pool: Pool, supabase: SupabaseClient, tenantId: number) {
  const { rows: products } = await pool.query<ProductRow>(
    `select id, name, description, price, stock_qty, image_url
       from public.products
      where tenant_id = $1 and is_active = true
      order by created_at desc`,
    [tenantId],
  );

  return Promise.all(
    products.map(async (product) => {
      if (!product.image_url || /^https?:\/\//i.test(product.image_url)) {
        return {
          ...product,
          price: Number(product.price),
          stock_qty: Number(product.stock_qty),
          image_url: product.image_url,
        };
      }

      const { data, error: imageError } = await supabase.storage
        .from(productImageBucket)
        .createSignedUrl(product.image_url, 60 * 60);

      if (imageError) {
        throw new Error(`Could not create an image URL for ${product.name}: ${imageError.message}`);
      }

      return {
        ...product,
        price: Number(product.price),
        stock_qty: Number(product.stock_qty),
        image_url: data.signedUrl,
      };
    }),
  );
}
