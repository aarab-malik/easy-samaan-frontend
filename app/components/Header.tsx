"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";
import { HiMagnifyingGlass, HiShoppingBag, HiChevronDown } from "react-icons/hi2";
import { apiClient } from "../lib/api-client";
import { Product } from "../lib/types";
import { DEMO_PRODUCTS } from "../lib/demo-products";
import { getDisplayPrice } from "../lib/pricing";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated, token } = useAuth();
  const isCustomerNav =
    !isAuthenticated || user?.role === "customer";
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const navItems = useMemo(() => {
    const base = [{ label: "Home", href: "/" }];
    if (!isAuthenticated || user?.role === "customer") {
      return [
        ...base,
        { label: "Shop", href: "/shop" },
        { label: "Checkout", href: "/checkout" },
      ];
    }
    return base;
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const updateCart = () => {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const count = Array.isArray(cart)
        ? cart.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0)
        : 0;
      setCartCount(count);
    };
    onScroll();
    updateCart();
    window.addEventListener("scroll", onScroll);
    window.addEventListener("storage", updateCart);
    window.addEventListener("cart:update", updateCart as EventListener);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("storage", updateCart);
      window.removeEventListener("cart:update", updateCart as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current) return;
      if (!searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isCustomerNav) {
      setSearchProducts([]);
      return;
    }
    if (query.trim().length < 2) {
      setSearchProducts([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      const normalizedQuery = query.trim().toLowerCase();
      const filterProducts = (products: Product[]) =>
        products.filter((product) =>
          [product.name, product.description || "", product.category || ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        );
      try {
        const data = await apiClient.get("/products", token || undefined);
        const products = (Array.isArray(data) ? data : data.items || []) as Product[];
        setSearchProducts(filterProducts(products).slice(0, 6));
      } catch {
        // Only use demo data for guests. For signed-in users, avoid mixing in
        // demo IDs that can route to non-existent backend products.
        if (!token) {
          setSearchProducts(filterProducts(DEMO_PRODUCTS).slice(0, 6));
        } else {
          setSearchProducts([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, isCustomerNav, token]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push("/");
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    router.push(`/shop?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
  };

  const userInitials = (user?.full_name || user?.email || "U")
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.header
      animate={{ paddingTop: scrolled ? 8 : 16, paddingBottom: scrolled ? 8 : 16 }}
      className="sticky top-0 z-50 border-b border-white/20 bg-gradient-to-r from-[#F37300] via-[#FF8D28] to-[#E67300] px-5 backdrop-blur-xl lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-45 [background:radial-gradient(circle_at_12%_22%,rgba(255,255,255,0.5),transparent_35%),radial-gradient(circle_at_85%_5%,rgba(255,215,173,0.35),transparent_34%)]" />
      <motion.div
        animate={{ height: scrolled ? 62 : 76 }}
        className="relative mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-6 lg:gap-10"
      >
        <Link href="/" className="shrink-0 text-white transition-opacity hover:opacity-90">
          <Logo variant="full" size={34} className="text-white" />
        </Link>

        <div
          ref={searchContainerRef}
          className={`relative min-w-[260px] flex-1 ${isCustomerNav ? "hidden md:block" : "hidden"}`}
        >
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 rounded-full border border-white/35 bg-white/90 px-4 py-2 shadow-lg transition-all focus-within:scale-[1.01] focus-within:shadow-orange-300/60"
          >
            <HiMagnifyingGlass className="text-lg text-[#757575]" />
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, brands, categories..."
              className="w-full bg-transparent text-sm text-[#1E1E1E] outline-none placeholder:text-[#757575]"
            />
            <span className="rounded-md border border-[#D9D9D9] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#757575]">
              Ctrl+K
            </span>
          </form>
          <AnimatePresence>
            {searchOpen && query.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute left-0 right-0 top-14 z-40 overflow-hidden rounded-2xl border border-[#ffd8b2] bg-white p-2 shadow-2xl"
              >
                {searchLoading ? (
                  <p className="px-3 py-2 text-sm text-[#757575]">Searching products...</p>
                ) : searchProducts.length === 0 ? (
                  <button
                    onClick={() => {
                      router.push(`/shop?q=${encodeURIComponent(query)}`);
                      setSearchOpen(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#1E1E1E] hover:bg-[#fff4e5]"
                  >
                    No exact matches. Search all for &quot;{query}&quot;
                  </button>
                ) : (
                  <>
                    {searchProducts.map((product) => (
                      <button
                        key={product.product_id}
                        onClick={() => {
                          router.push(`/product/${product.product_id}`);
                          setSearchOpen(false);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left hover:bg-[#fff4e5]"
                      >
                        <p className="text-sm font-semibold text-[#1E1E1E]">{product.name}</p>
                        <p className="text-xs text-[#757575]">
                          {product.category || "Product"} · Rs. {getDisplayPrice(product)}
                        </p>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        router.push(`/shop?q=${encodeURIComponent(query)}`);
                        setSearchOpen(false);
                      }}
                      className="mt-1 block w-full rounded-xl border border-[#ffe2be] bg-[#fff9f2] px-3 py-2 text-left text-sm font-semibold text-[#c25a00] hover:bg-[#fff4e5]"
                    >
                      View all results
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative overflow-hidden rounded-full px-5 py-2 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-full bg-[#1E1E1E]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${active ? "text-white" : "text-white/95"}`}>{item.label}</span>
              </Link>
            );
          })}
          {user?.role === "shop_owner" && (
            <Link href="/shop-owner" className="rounded-full px-4 py-2 text-sm font-semibold text-white/95 transition-all hover:bg-black/25">
              My Shop
            </Link>
          )}
          {user?.role === "rider" && (
            <Link href="/rider" className="rounded-full px-4 py-2 text-sm font-semibold text-white/95 transition-all hover:bg-black/25">
              Deliveries
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 lg:gap-3">
          {isCustomerNav && (
            <Link
              href="/checkout"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/95 text-[#1E1E1E] shadow-md transition-all duration-300 hover:scale-105 hover:bg-white active:scale-[0.97]"
              title="Cart"
            >
              <HiShoppingBag className="text-xl" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1E1E1E] px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-black/80 px-2 py-1.5 text-white transition-all hover:scale-[1.02]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FFB870] text-xs font-bold text-[#1E1E1E]">
                  {userInitials}
                </span>
                <span className="hidden text-sm font-semibold lg:inline">{user.full_name || user.email}</span>
                <HiChevronDown className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 top-14 z-30 min-w-48 rounded-2xl border border-[#FFE2BE] bg-white p-2 shadow-xl"
                  >
                    <button onClick={() => { setMenuOpen(false); router.push("/profile"); }} className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#1E1E1E] transition hover:bg-[#FFF4E5]">
                      Profile
                    </button>
                    {user.role === "shop_owner" && (
                      <button onClick={() => { setMenuOpen(false); router.push("/shop-owner"); }} className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#1E1E1E] transition hover:bg-[#FFF4E5]">
                        My Shop
                      </button>
                    )}
                    {user.role === "rider" && (
                      <button onClick={() => { setMenuOpen(false); router.push("/rider"); }} className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#1E1E1E] transition hover:bg-[#FFF4E5]">
                        Deliveries
                      </button>
                    )}
                    <button onClick={handleLogout} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#C25A00] transition hover:bg-[#FFF4E5]">
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-full border border-white/55 bg-white/20 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:bg-white/30 active:scale-[0.97]"
              >
                Login
              </Link>
            <Link
              href="/signup"
              className="rounded-full border border-black bg-[#1E1E1E] px-5 py-2 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.03] hover:bg-black active:scale-[0.97]"
            >
              Sign Up
            </Link>
            </div>
          )}
        </div>
      </motion.div>
    </motion.header>
  );
}
