'use client';

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";
import { Product } from "../lib/types";
import { getDisplayPrice, hasActiveDiscount } from "../lib/pricing";
import { getProductImageUrl } from "../lib/product-images";
import { HiMagnifyingGlass, HiHeart, HiChevronDown } from "react-icons/hi2";
import { motion } from "motion/react";
import { FadeUp, Stagger, StaggerItem } from "../components/MotionPrimitives";
import { useSearchParams, useRouter } from "next/navigation";
import { DEMO_PRODUCTS } from "../lib/demo-products";

const WISHLIST_KEY = "easysamaan_wishlist_v1";
/** Upper bound for price sliders and default max filter (Rs). */
const PRICE_CAP = 5000;

function productIsSoldOut(product: Product): boolean {
  return typeof product.stock_quantity === "number" && product.stock_quantity <= 0;
}

interface ShopFilters {
  searchTerm: string;
  minPrice: number;
  maxPrice: number;
  selectedCategories: string[];
  inStockOnly: boolean;
}

const defaultFilters = (): ShopFilters => ({
  searchTerm: "",
  minPrice: 0,
  maxPrice: PRICE_CAP,
  selectedCategories: [],
  inStockOnly: false,
});

function cloneFilters(f: ShopFilters): ShopFilters {
  return {
    ...f,
    selectedCategories: [...f.selectedCategories],
  };
}

function filtersPending(draft: ShopFilters, applied: ShopFilters): boolean {
  if (draft.searchTerm !== applied.searchTerm) return true;
  if (draft.minPrice !== applied.minPrice || draft.maxPrice !== applied.maxPrice) return true;
  if (draft.inStockOnly !== applied.inStockOnly) return true;
  if (draft.selectedCategories.length !== applied.selectedCategories.length) return true;
  const a = [...draft.selectedCategories].sort().join("\0");
  const b = [...applied.selectedCategories].sort().join("\0");
  return a !== b;
}

function ShopPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, user, isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ShopFilters>(() => defaultFilters());
  const [applied, setApplied] = useState<ShopFilters>(() => defaultFilters());
  const [showCategory, setShowCategory] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [sort, setSort] = useState("name");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [quickAddProductId, setQuickAddProductId] = useState<string | null>(null);
  const [guestDemoCatalog, setGuestDemoCatalog] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<Record<string, boolean>>({});
  /** Sync price sliders once per catalog (token + product ids); avoids overwriting user tweaks & min>max bugs. */
  const priceRangeSyncKey = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      if (raw) setWishlist(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persistWishlist = (ids: string[]) => {
    setWishlist(ids);
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (isAuthenticated && user && (user.role === "shop_owner" || user.role === "rider")) {
      router.replace("/");
      return;
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiClient.get("/products", token || undefined);
        setProducts(Array.isArray(data) ? data : data.items || []);
        setGuestDemoCatalog(false);
      } catch (err) {
        console.error(err);
        if (!token) {
          setProducts(DEMO_PRODUCTS);
          setGuestDemoCatalog(true);
          setError("");
        } else {
          setGuestDemoCatalog(false);
          setError("Failed to load products");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [token]);

  useEffect(() => {
    if (products.length === 0) return;
    const ids = products
      .map((p) => p.product_id)
      .slice()
      .sort()
      .join("|");
    const key = `${token ?? "guest"}:${ids}`;
    if (priceRangeSyncKey.current === key) return;

    const prices = products.map((p) => getDisplayPrice(p));
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const upper = Math.min(PRICE_CAP, Math.max(Math.ceil(hi * 1.1), hi, lo));
    const lower = Math.max(0, Math.floor(lo));
    const minP = Math.min(lower, upper);
    setDraft((d) => ({ ...d, minPrice: minP, maxPrice: upper }));
    setApplied((a) => ({ ...a, minPrice: minP, maxPrice: upper }));
    priceRangeSyncKey.current = key;
  }, [products, token]);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setDraft((d) => ({ ...d, searchTerm: q }));
    setApplied((a) => ({ ...a, searchTerm: q }));
  }, [searchParams]);

  const categoryBuckets = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const c = (p.category || "Uncategorized").trim() || "Uncategorized";
      m.set(c, (m.get(c) || 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  useEffect(() => {
    const valid = new Set(categoryBuckets.map((b) => b.name));
    const prune = (cats: string[]) => cats.filter((c) => valid.has(c));
    setDraft((d) => ({ ...d, selectedCategories: prune(d.selectedCategories) }));
    setApplied((a) => ({ ...a, selectedCategories: prune(a.selectedCategories) }));
  }, [categoryBuckets]);

  const toggleCategory = (name: string) => {
    setDraft((d) => ({
      ...d,
      selectedCategories: d.selectedCategories.includes(name)
        ? d.selectedCategories.filter((x) => x !== name)
        : [...d.selectedCategories, name],
    }));
  };

  const applyFilters = () => {
    setApplied(cloneFilters(draft));
  };

  const clearAllFilters = () => {
    if (products.length) {
      const prices = products.map((p) => getDisplayPrice(p));
      const lo = Math.min(...prices);
      const hi = Math.max(...prices);
      const upper = Math.min(PRICE_CAP, Math.max(Math.ceil(hi * 1.1), hi, lo));
      const lower = Math.max(0, Math.floor(lo));
      const minP = Math.min(lower, upper);
      const next: ShopFilters = {
        searchTerm: "",
        minPrice: minP,
        maxPrice: upper,
        selectedCategories: [],
        inStockOnly: false,
      };
      setDraft(next);
      setApplied(cloneFilters(next));
    } else {
      const next = defaultFilters();
      setDraft(next);
      setApplied(cloneFilters(next));
    }
  };

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    applied.selectedCategories.forEach((c) => chips.push(`Category: ${c}`));
    chips.push(`Rs.${applied.minPrice} – Rs.${applied.maxPrice}`);
    if (applied.inStockOnly) chips.push("In stock only");
    if (applied.searchTerm.trim()) chips.push(`Search: “${applied.searchTerm.trim()}”`);
    return chips;
  }, [applied]);

  const showPendingHint = useMemo(() => filtersPending(draft, applied), [draft, applied]);

  const handleQuickAdd = (product: Product) => {
    if (!isAuthenticated || user?.role !== "customer") {
      alert("Please log in as a customer to add items to cart.");
      router.push("/login");
      return;
    }
    if (productIsSoldOut(product)) {
      alert("This item is sold out.");
      return;
    }
    const unit = getDisplayPrice(product);
    const cart = JSON.parse(localStorage.getItem("cart") || "[]") as Array<{
      product_id: string;
      shop_id: string;
      name: string;
      price: number;
      quantity: number;
    }>;

    const existingItem = cart.find((item) => item.product_id === product.product_id);
    if (existingItem) {
      const cap =
        typeof product.stock_quantity === "number" ? product.stock_quantity : Number.POSITIVE_INFINITY;
      if (existingItem.quantity + 1 > cap) {
        alert(`Only ${cap} in stock for this product.`);
        return;
      }
      existingItem.quantity += 1;
      existingItem.price = unit;
    } else {
      cart.push({
        product_id: product.product_id,
        shop_id: product.shop_id,
        name: product.name,
        price: unit,
        quantity: 1,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cart:update"));
    setQuickAddProductId(product.product_id);
    window.setTimeout(() => setQuickAddProductId(null), 900);
  };

  const filteredAndSorted = useMemo(() => {
    const priceLow = Math.min(applied.minPrice, applied.maxPrice);
    const priceHigh = Math.max(applied.minPrice, applied.maxPrice);

    let list = products.filter((product) => {
      const query = applied.searchTerm.trim().toLowerCase();
      if (
        query &&
        ![product.name, product.description || "", product.category || ""].join(" ").toLowerCase().includes(query)
      ) {
        return false;
      }
      const display = getDisplayPrice(product);
      if (display < priceLow || display > priceHigh) return false;
      if (applied.selectedCategories.length) {
        const cat = (product.category || "Uncategorized").trim() || "Uncategorized";
        if (!applied.selectedCategories.includes(cat)) return false;
      }
      if (applied.inStockOnly && productIsSoldOut(product)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    else if (sort === "price-desc") list = [...list].sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, applied, sort]);

  if (isAuthenticated && user && (user.role === "shop_owner" || user.role === "rider")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <main className="mx-auto max-w-7xl px-4 py-10 text-black">
        {guestDemoCatalog && !token && (
          <div
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-black"
            role="status"
          >
            You&apos;re browsing a <strong>sample catalog</strong> because the store API didn&apos;t return products
            without signing in. Sign in to load the live catalog when your backend allows it.
          </div>
        )}
        <div className="flex gap-8">
          <aside className="w-[300px] flex-shrink-0">
            <div className="sticky top-28 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-black">Filters</h2>
                  <p className="text-xs font-medium text-black/70">
                    {activeFilterChips.length} applied
                    {showPendingHint ? " · pending changes" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-neutral-50"
                >
                  Clear all
                </button>
              </div>
              <p className="mb-3 text-xs text-black/60">
                Choose categories, price, and availability, then tap <strong>Apply filters</strong> to update the grid.
              </p>

              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <button
                    type="button"
                    onClick={() => setShowCategory((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-bold text-black"
                  >
                    Categories <HiChevronDown className={`transition-transform ${showCategory ? "rotate-180" : ""}`} />
                  </button>
                  {showCategory && (
                    <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                      {categoryBuckets.length === 0 ? (
                        <p className="text-xs text-black/60">No categories yet</p>
                      ) : (
                        categoryBuckets.map((category) => (
                          <label
                            key={category.name}
                            className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-100"
                          >
                            <span className="flex items-center gap-2 text-sm text-black">
                              <input
                                type="checkbox"
                                checked={draft.selectedCategories.includes(category.name)}
                                onChange={() => toggleCategory(category.name)}
                                className="accent-[#FF8D28]"
                              />
                              {category.name}
                            </span>
                            <span className="text-xs text-black/60">{category.count}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <button
                    type="button"
                    onClick={() => setShowPrice((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-bold text-black"
                  >
                    Price (sale price) <HiChevronDown className={`transition-transform ${showPrice ? "rotate-180" : ""}`} />
                  </button>
                  {showPrice && (
                    <div className="mt-3 space-y-3">
                      <input
                        type="range"
                        min={0}
                        max={PRICE_CAP}
                        value={Math.min(draft.minPrice, PRICE_CAP)}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          setDraft((d) => ({
                            ...d,
                            minPrice: Math.min(Math.max(0, raw), Math.min(d.maxPrice, PRICE_CAP)),
                          }));
                        }}
                        className="w-full accent-[#FF8D28]"
                      />
                      <input
                        type="range"
                        min={0}
                        max={PRICE_CAP}
                        value={Math.min(draft.maxPrice, PRICE_CAP)}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          setDraft((d) => ({
                            ...d,
                            maxPrice: Math.min(PRICE_CAP, Math.max(Math.max(0, raw), d.minPrice)),
                          }));
                        }}
                        className="w-full accent-[#FF8D28]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          max={PRICE_CAP}
                          value={draft.minPrice}
                          onChange={(e) => {
                            const t = e.target.value;
                            if (t.trim() === "") return;
                            const v = Number(t);
                            if (!Number.isFinite(v) || v < 0) return;
                            setDraft((d) => ({
                              ...d,
                              minPrice: Math.min(v, Math.min(d.maxPrice, PRICE_CAP)),
                            }));
                          }}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-[#FF8D28]"
                        />
                        <input
                          type="number"
                          min={0}
                          max={PRICE_CAP}
                          value={draft.maxPrice}
                          onChange={(e) => {
                            const t = e.target.value;
                            if (t.trim() === "") return;
                            const v = Number(t);
                            if (!Number.isFinite(v) || v < 0) return;
                            setDraft((d) => ({
                              ...d,
                              maxPrice: Math.min(PRICE_CAP, Math.max(v, d.minPrice)),
                            }));
                          }}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-[#FF8D28]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <button
                    type="button"
                    onClick={() => setShowAvailability((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-bold text-black"
                  >
                    Availability <HiChevronDown className={`transition-transform ${showAvailability ? "rotate-180" : ""}`} />
                  </button>
                  {showAvailability && (
                    <div className="mt-3">
                      <label className="flex cursor-pointer items-center justify-between text-sm text-black">
                        In stock only
                        <input
                          type="checkbox"
                          checked={draft.inStockOnly}
                          onChange={(e) => setDraft((d) => ({ ...d, inStockOnly: e.target.checked }))}
                          className="accent-[#FF8D28]"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="w-full rounded-xl bg-[#FF8D28] py-3 text-sm font-bold text-black shadow-sm transition-colors hover:bg-[#f37300]"
                >
                  Apply filters
                </button>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              {activeFilterChips.map((filter) => (
                <span
                  key={filter}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FF8D28] px-3 py-1.5 text-xs font-semibold text-black"
                >
                  {filter}
                </span>
              ))}
            </div>

            <div className="mb-8 flex flex-wrap items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                <HiMagnifyingGlass className="text-lg text-black/50" />
                <input
                  type="text"
                  value={draft.searchTerm}
                  onChange={(event) => setDraft((d) => ({ ...d, searchTerm: event.target.value }))}
                  placeholder="Search products or categories… (use Apply filters)"
                  className="w-full bg-transparent text-sm text-black outline-none placeholder:text-black/45"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-black shadow-sm outline-none focus:border-[#FF8D28]"
              >
                <option value="name">Sort: Name A–Z</option>
                <option value="price-asc">Sort: Price low to high</option>
                <option value="price-desc">Sort: Price high to low</option>
              </select>
            </div>

            {loading && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="animated-shimmer mb-4 h-56 rounded-xl" />
                    <div className="animated-shimmer mb-2 h-5 rounded" />
                    <div className="animated-shimmer h-4 w-3/4 rounded" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="py-12 text-center text-red-600">
                <p>{error}</p>
              </div>
            )}

            {!loading && !error && (
              <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSorted.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-black">No products match your filters</div>
                ) : (
                  filteredAndSorted.map((product) => {
                    const display = getDisplayPrice(product);
                    const disc = hasActiveDiscount(product);
                    return (
                      <StaggerItem key={product.product_id}>
                        <FadeUp>
                          <motion.div
                            whileHover={{ y: -8 }}
                            className="group rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-neutral-300 hover:shadow-md"
                          >
                            <div className="relative mb-4 overflow-hidden rounded-xl bg-neutral-200">
                              {disc && (
                                <span className="absolute left-3 top-3 z-10 rounded-full bg-black px-2 py-1 text-xs font-semibold text-white">
                                  {Math.round(product.discount_percent ?? 0)}% OFF
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  persistWishlist(
                                    wishlist.includes(product.product_id)
                                      ? wishlist.filter((id) => id !== product.product_id)
                                      : [...wishlist, product.product_id]
                                  )
                                }
                                className={`absolute right-3 top-3 z-10 rounded-full border border-neutral-200 bg-white p-2 text-black transition-all hover:bg-[#FF8D28] ${
                                  wishlist.includes(product.product_id) ? "bg-[#FF8D28] text-black" : ""
                                }`}
                                title={wishlist.includes(product.product_id) ? "Remove from favorites" : "Save to favorites"}
                              >
                                <HiHeart />
                              </button>
                              <div className="flex h-56 items-center justify-center transition-transform duration-500 group-hover:scale-110">
                                {imageLoadError[product.product_id] ? (
                                  <span className="text-sm text-black/55">Product Image</span>
                                ) : (
                                  <img
                                    src={getProductImageUrl(product.name)}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    onError={() =>
                                      setImageLoadError((prev) => ({ ...prev, [product.product_id]: true }))
                                    }
                                  />
                                )}
                              </div>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-black">{product.name}</h3>
                            <p className="mb-2 line-clamp-2 text-sm text-black/80">{product.description || "No description"}</p>
                            {product.category && <p className="mb-2 text-xs font-semibold text-black">{product.category}</p>}
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              {productIsSoldOut(product) ? (
                                <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                  Sold out
                                </span>
                              ) : typeof product.stock_quantity === "number" ? (
                                <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-black">
                                  {product.stock_quantity} in stock
                                </span>
                              ) : null}
                            </div>
                            <div className="mb-4 flex items-center justify-between gap-2">
                              <p className="text-xl font-bold text-black">Rs. {display}</p>
                              {disc ? (
                                <span className="text-sm text-black/50 line-through">Rs. {product.price}</span>
                              ) : (
                                <span className="text-xs text-black/40"> </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleQuickAdd(product)}
                                disabled={productIsSoldOut(product)}
                                className="rounded-xl bg-[#FF8D28] px-3 py-2 text-sm font-semibold text-black opacity-0 transition-all duration-300 hover:bg-[#f37300] group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {productIsSoldOut(product) ? "Sold out" : quickAddProductId === product.product_id ? "Added!" : "Quick Add"}
                              </button>
                              <Link
                                href={`/product/${product.product_id}`}
                                className="rounded-xl bg-[#FF8D28] px-4 py-2 text-center text-sm font-semibold text-black transition-all duration-300 hover:bg-[#f37300]"
                              >
                                View Details
                              </Link>
                            </div>
                          </motion.div>
                        </FadeUp>
                      </StaggerItem>
                    );
                  })
                )}
              </Stagger>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white py-8 text-center text-black">Loading shop...</div>}>
      <ShopPageContent />
    </Suspense>
  );
}
