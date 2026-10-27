import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/database";
import { requireSameOrigin } from "@/lib/admin-request";
import { getTenantDatabaseId } from "@/lib/tenant-config";
import { getTenantBySlug } from "@/lib/tenant-data";

type RouteProps = {
  params: Promise<{ tenant: string }>;
};

type QuoteProduct = {
  id: number;
  name: string;
  price: string;
  stock_qty: number;
};

type QuoteRequestItem = {
  productId: number;
  quantity: number;
};

const MAX_REQUEST_SIZE = 32 * 1024;
const MAX_QUOTE_ITEMS = 50;
const MAX_ITEM_QUANTITY = 1_000_000;
const MAX_TOTAL_CENTS = 999_999_999_999;

function isQuoteRequestItem(value: unknown): value is QuoteRequestItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "number" &&
    Number.isSafeInteger(item.productId) &&
    item.productId > 0 &&
    item.productId <= 2_147_483_647 &&
    typeof item.quantity === "number" &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= MAX_ITEM_QUANTITY
  );
}

function priceToCents(price: string) {
  return Math.round(Number(price) * 100);
}

function formatCents(cents: number) {
  return `${Math.floor(cents / 100)}.${(cents % 100).toString().padStart(2, "0")}`;
}

async function rollback(client: PoolClient) {
  await client.query("rollback");
}

export async function POST(request: Request, { params }: RouteProps) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "The quote request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The quote request could not be read." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Enter a valid quote request." }, { status: 400 });
  }
  const requestBody = body as Record<string, unknown>;
  const customerMobile = requestBody.customerMobile;
  const items = requestBody.items;
  if (
    typeof customerMobile !== "string" ||
    !/^\+[1-9]\d{7,14}$/.test(customerMobile) ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > MAX_QUOTE_ITEMS ||
    !items.every(isQuoteRequestItem)
  ) {
    return NextResponse.json({ error: "Enter a valid mobile number and at least one valid cart item." }, { status: 400 });
  }

  const quoteItems = items as QuoteRequestItem[];
  const productIds = quoteItems.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    return NextResponse.json({ error: "Each product can appear only once in the quote." }, { status: 400 });
  }

  const ownerWhatsAppNumber = process.env.APP_OWNER_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
  if (!/^[1-9]\d{7,14}$/.test(ownerWhatsAppNumber)) {
    return NextResponse.json({ error: "WhatsApp quotes are unavailable right now. Please contact the store." }, { status: 503 });
  }

  const { tenant: tenantSlug } = await params;
  const storefront = getTenantBySlug(tenantSlug);
  if (!storefront) {
    return NextResponse.json({ error: "This store is not configured in the application." }, { status: 404 });
  }

  let tenantId: number;
  let client: PoolClient;
  try {
    const configuredTenantId = getTenantDatabaseId(tenantSlug);
    if (configuredTenantId === undefined) {
      return NextResponse.json({ error: "This store has no database ID configured." }, { status: 500 });
    }
    tenantId = configuredTenantId;
    client = await getDatabasePool().connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database configuration is invalid.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;

    const tenant = await client.query(
      "select id from public.tenants where id = $1 and slug = $2 limit 1",
      [tenantId, storefront.slug],
    );
    if (!tenant.rows[0]) {
      await rollback(client);
      transactionOpen = false;
      return NextResponse.json({ error: "Configured store does not match a database tenant." }, { status: 404 });
    }

    const productResult = await client.query<QuoteProduct>(
      `select id, name, price::text, stock_qty
         from public.products
        where tenant_id = $1 and is_active = true and id = any($2::integer[])
        order by id
        for update`,
      [tenantId, productIds],
    );
    if (productResult.rows.length !== quoteItems.length) {
      await rollback(client);
      transactionOpen = false;
      return NextResponse.json({ error: "One or more products are no longer available. Refresh the storefront and try again." }, { status: 409 });
    }

    const productById = new Map(productResult.rows.map((product) => [product.id, product]));
    for (const item of quoteItems) {
      const product = productById.get(item.productId);
      if (!product || product.stock_qty < item.quantity) {
        await rollback(client);
        transactionOpen = false;
        return NextResponse.json(
          { error: `${product?.name ?? "A product"} no longer has enough stock. Refresh the storefront and update your cart.` },
          { status: 409 },
        );
      }
    }

    let totalCents = 0;
    for (const item of quoteItems) {
      const product = productById.get(item.productId)!;
      const lineTotalCents = priceToCents(product.price) * item.quantity;
      if (!Number.isSafeInteger(lineTotalCents)) {
        await rollback(client);
        transactionOpen = false;
        return NextResponse.json({ error: "The quote total exceeds the supported amount." }, { status: 400 });
      }
      totalCents += lineTotalCents;
      if (!Number.isSafeInteger(totalCents)) {
        await rollback(client);
        transactionOpen = false;
        return NextResponse.json({ error: "The quote total exceeds the supported amount." }, { status: 400 });
      }
      if (totalCents > MAX_TOTAL_CENTS) {
        await rollback(client);
        transactionOpen = false;
        return NextResponse.json({ error: "The quote total exceeds the supported amount." }, { status: 400 });
      }
    }

    const quoteResult = await client.query<{ id: number }>(
      `insert into public.storefront_quotes (tenant_id, customer_mobile, total)
       values ($1, $2, $3)
       returning id`,
      [tenantId, customerMobile, formatCents(totalCents)],
    );
    const quoteId = quoteResult.rows[0].id;

    for (const item of quoteItems) {
      const product = productById.get(item.productId)!;
      await client.query(
        `insert into public.storefront_quote_items
           (tenant_id, quote_id, product_id, product_name, quantity, unit_price)
         values ($1, $2, $3, $4, $5, $6)`,
        [tenantId, quoteId, product.id, product.name, item.quantity, product.price],
      );
      const remainingStock = product.stock_qty - item.quantity;
      await client.query(
        "update public.products set stock_qty = $1 where tenant_id = $2 and id = $3",
        [remainingStock, tenantId, product.id],
      );
      await client.query(
        `insert into public.inventory_log (tenant_id, product_id, change_qty, reason)
         values ($1, $2, $3, $4)`,
        [tenantId, product.id, -item.quantity, `Quote ${quoteId} submitted`],
      );
    }

    await client.query("commit");
    transactionOpen = false;

    const message = [
      `Hello ${storefront.name}, I would like a quote for:`,
      ...quoteItems.map((item) => {
        const product = productById.get(item.productId)!;
        const productName = product.name.replace(/[\r\n]+/g, " ").trim();
        const lineTotal = priceToCents(product.price) * item.quantity;
        return `- ${productName} x ${item.quantity}: ${storefront.currency} ${formatCents(lineTotal)}`;
      }),
      `Total: ${storefront.currency} ${formatCents(totalCents)}`,
      `Customer mobile: ${customerMobile}`,
      `Quote reference: ${quoteId}`,
    ].join("\n");
    const whatsappUrl = `https://wa.me/${ownerWhatsAppNumber}?text=${encodeURIComponent(message)}`;
    const remainingStock = quoteItems.map((item) => ({
      productId: item.productId,
      stockQty: productById.get(item.productId)!.stock_qty - item.quantity,
    }));

    return NextResponse.json({ quoteId, whatsappUrl, remainingStock }, { status: 201 });
  } catch (error) {
    if (transactionOpen) await rollback(client);
    const message = error instanceof Error ? error.message : "Could not save your quote.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    client.release();
  }
}
