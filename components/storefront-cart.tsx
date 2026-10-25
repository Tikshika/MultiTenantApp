"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
};

const StorefrontCartContext = createContext<StorefrontCartContextValue | null>(null);

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<number, CartItem>>({});

  function addToCart(product: CartProduct, stockQty: number) {
    setItems((currentItems) => ({
      ...currentItems,
      [product.id]: {
        product,
        stockQty,
        quantity: Math.min((currentItems[product.id]?.quantity ?? 0) + 1, stockQty),
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

  const cartItems = Object.values(items);
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <StorefrontCartContext.Provider
      value={{ itemCount, items: cartItems, addToCart, removeFromCart, quantityInCart }}
    >
      {children}
    </StorefrontCartContext.Provider>
  );
}

export function useStorefrontCart() {
  const cart = useContext(StorefrontCartContext);
  if (!cart) {
    throw new Error("useStorefrontCart must be used within a StorefrontCartProvider.");
  }
  return cart;
}

export function StorefrontCartButton({ accent, currency }: { accent: string; currency: string }) {
  const { itemCount, items, addToCart, removeFromCart } = useStorefrontCart();
  const [isOpen, setIsOpen] = useState(false);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

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
        onClick={() => setIsOpen(true)}
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
                <p className="text-lg font-semibold text-slate-900">Your cart is empty</p>
                <p className="mt-2 text-sm text-slate-600">Add products to see them here.</p>
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
                  <div className="flex justify-between text-lg font-bold text-slate-900">
                    <span>Total</span>
                    <span>{currency} {total.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Delivery and payment are arranged with the store.</p>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
