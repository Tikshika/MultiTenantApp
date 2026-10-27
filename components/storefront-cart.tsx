"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";

export type CartProduct = {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
};

type CartItem = {
  product: CartProduct;
  quantity: number;
  stockQty: number;
};

type StorefrontCartContextValue = {
  itemCount: number;
  items: CartItem[];
  addToCart: (product: CartProduct, stockQty: number) => void;
  removeFromCart: (productId: number) => void;
  quantityInCart: (productId: number) => number;
  stockAvailable: (productId: number, fallback: number) => number;
  updateStock: (productId: number, stockQty: number) => void;
  clearCart: () => void;
};

const StorefrontCartContext = createContext<StorefrontCartContextValue | null>(null);

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<number, CartItem>>({});
  const [stockOverrides, setStockOverrides] = useState<Record<number, number>>({});

  function addToCart(product: CartProduct, stockQty: number) {
    setItems((currentItems) => ({
      ...currentItems,
      [product.id]: {
        product,
        stockQty: stockOverrides[product.id] ?? stockQty,
        quantity: Math.min(
          (currentItems[product.id]?.quantity ?? 0) + 1,
          stockOverrides[product.id] ?? stockQty,
        ),
      },
    }));
  }

  function removeFromCart(productId: number) {
    setItems((currentItems) => {
      const item = currentItems[productId];
      const quantity = item?.quantity ?? 0;
      if (quantity <= 1) {
        const remainingItems = { ...currentItems };
        delete remainingItems[productId];
        return remainingItems;
      }
      return { ...currentItems, [productId]: { ...item, quantity: quantity - 1 } };
    });
  }

  function quantityInCart(productId: number) {
    return items[productId]?.quantity ?? 0;
  }

  function stockAvailable(productId: number, fallback: number) {
    return stockOverrides[productId] ?? fallback;
  }

  function updateStock(productId: number, stockQty: number) {
    setStockOverrides((current) => ({ ...current, [productId]: stockQty }));
  }

  function clearCart() {
    setItems({});
  }

  const cartItems = Object.values(items);
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <StorefrontCartContext.Provider
      value={{
        itemCount,
        items: cartItems,
        addToCart,
        removeFromCart,
        quantityInCart,
        stockAvailable,
        updateStock,
        clearCart,
      }}
    >
      {children}
    </StorefrontCartContext.Provider>
  );
}

function normalizeCustomerMobile(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return digits ? `+91${digits}` : "";
}

export function useStorefrontCart() {
  const cart = useContext(StorefrontCartContext);
  if (!cart) {
    throw new Error("useStorefrontCart must be used within a StorefrontCartProvider.");
  }
  return cart;
}

export function StorefrontCartButton({
  accent,
  currency,
  tenantSlug,
}: {
  accent: string;
  currency: string;
  tenantSlug: string;
}) {
  const { itemCount, items, addToCart, removeFromCart, updateStock, clearCart } = useStorefrontCart();
  const [isOpen, setIsOpen] = useState(false);
  const [customerMobile, setCustomerMobile] = useState("+91");
  const [checkoutError, setCheckoutError] = useState("");
  const [quoteWhatsAppUrl, setQuoteWhatsAppUrl] = useState("");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function openCart() {
    setCheckoutError("");
    setIsOpen(true);
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mobile = normalizeCustomerMobile(customerMobile);
    setCustomerMobile(mobile || "+91");
    if (!/^\+[1-9]\d{7,14}$/.test(mobile)) {
      setCheckoutError("Enter a valid mobile number with country code, such as +919876543210.");
      return;
    }

    if (items.length === 0 || isSubmittingQuote) return;

    const whatsappWindow = window.open("about:blank", "_blank");
    if (whatsappWindow) whatsappWindow.opener = null;
    setIsSubmittingQuote(true);
    setCheckoutError("");
    setQuoteWhatsAppUrl("");

    try {
      const response = await fetch(`/api/storefront/${encodeURIComponent(tenantSlug)}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerMobile: mobile,
          items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        whatsappUrl?: string;
        remainingStock?: Array<{ productId: number; stockQty: number }>;
      };
      if (!response.ok || !result.whatsappUrl || !result.remainingStock) {
        throw new Error(result.error ?? "Could not save your quote.");
      }

      for (const stock of result.remainingStock) updateStock(stock.productId, stock.stockQty);
      clearCart();
      setQuoteWhatsAppUrl(result.whatsappUrl);
      if (whatsappWindow) {
        whatsappWindow.location.href = result.whatsappUrl;
      }
    } catch (submitError) {
      whatsappWindow?.close();
      setCheckoutError(submitError instanceof Error ? submitError.message : "Could not save your quote.");
    } finally {
      setIsSubmittingQuote(false);
    }

  }

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
        aria-expanded={isOpen}
        onClick={openCart}
        className="rounded-full px-4 py-2 text-white shadow-sm"
        style={{ backgroundColor: accent }}
      >
        Cart ({itemCount})
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/40"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 id="cart-title" className="text-xl font-bold text-slate-900">Your cart</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close cart"
                onClick={() => setIsOpen(false)}
                className="rounded-full px-3 py-2 text-2xl leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                {quoteWhatsAppUrl ? (
                  <>
                    <p className="text-lg font-semibold text-slate-900">Your quote was saved.</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Continue in WhatsApp to review the quote and send it to the store.
                    </p>
                    <a
                      href={quoteWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Open WhatsApp
                    </a>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-slate-900">Your cart is empty</p>
                    <p className="mt-2 text-sm text-slate-600">Add products to see them here.</p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="mt-5 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: accent }}
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                  {items.map(({ product, quantity, stockQty }) => (
                    <li
                      key={product.id}
                      className="flex gap-4 border-b border-slate-100 pb-4"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="h-20 w-20 shrink-0 rounded-xl"
                          style={{ background: `linear-gradient(135deg, ${accent}, #f8fafc)` }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-3">
                          <h3 className="font-semibold text-slate-900">{product.name}</h3>
                          <p className="shrink-0 font-semibold text-slate-900">
                            {currency} {(product.price * quantity).toFixed(2)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {currency} {product.price.toFixed(2)} each
                        </p>
                        <div className="mt-3 inline-flex items-center overflow-hidden rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => removeFromCart(product.id)}
                            aria-label={`Remove one ${product.name}`}
                            className="px-3 py-1.5 text-lg hover:bg-slate-100"
                          >
                            −
                          </button>
                          <span
                            aria-live="polite"
                            aria-label={`${quantity} ${product.name} in cart`}
                            className="min-w-9 text-center text-sm font-semibold"
                          >
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(product, stockQty)}
                            disabled={quantity >= stockQty}
                            aria-label={`Add one ${product.name}`}
                            className="px-3 py-1.5 text-lg hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <footer className="border-t border-slate-200 px-5 py-5 sm:px-6">
                  <form onSubmit={submitQuote}>
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Your mobile number (with country code)
                      <input
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        required
                        maxLength={24}
                        value={customerMobile}
                        onChange={(event) => {
                          setCustomerMobile(event.currentTarget.value);
                          setCheckoutError("");
                        }}
                        onBlur={() => setCustomerMobile(normalizeCustomerMobile(customerMobile) || "+91")}
                        placeholder="+919876543210"
                        aria-describedby={checkoutError ? "quote-error" : "mobile-help"}
                        aria-invalid={Boolean(checkoutError)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                      />
                    </label>
                    <p id="mobile-help" className="mt-1 text-xs text-slate-500">
                      India&apos;s country code (+91) is prefilled and added if omitted. WhatsApp opens with your quote for you to review and send.
                    </p>
                    {checkoutError && (
                      <p id="quote-error" role="alert" className="mt-2 text-sm text-red-700">
                        {checkoutError}
                      </p>
                    )}
                    <div className="mt-4 flex justify-between text-lg font-bold text-slate-900">
                      <span>Total</span>
                      <span>{currency} {total.toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Delivery and payment are arranged with the store.</p>
                    <button
                      type="submit"
                      disabled={isSubmittingQuote}
                      className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {isSubmittingQuote ? "Saving quote..." : "Request quote on WhatsApp"}
                    </button>
                  </form>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
