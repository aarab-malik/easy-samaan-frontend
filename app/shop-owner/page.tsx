'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { apiClient } from '../lib/api-client';
import { Shop, Product } from '../lib/types';
import { getDisplayPrice } from '../lib/pricing';

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function readLocalInt(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

export default function ShopOwnerPage() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [createShopLoading, setCreateShopLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock_quantity: '',
    discount_percent: '',
  });
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>({});
  const [restockDrafts, setRestockDrafts] = useState<Record<string, string>>({});
  const [reduceDrafts, setReduceDrafts] = useState<Record<string, string>>({});
  const [newShop, setNewShop] = useState({
    name: '',
    addressQuery: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [shopSuggestions, setShopSuggestions] = useState<NominatimSuggestion[]>([]);
  const [shopSuggestLoading, setShopSuggestLoading] = useState(false);
  const [apiShopMetrics, setApiShopMetrics] = useState<Record<string, unknown> | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [productTicks, setProductTicks] = useState<Record<string, boolean>>({});
  const successTimeoutRef = useRef<number | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = window.setTimeout(() => setSuccessMessage(''), 2800);
  }, []);

  const flashProductTick = useCallback((productId: string) => {
    setProductTicks((prev) => ({ ...prev, [productId]: true }));
    window.setTimeout(() => {
      setProductTicks((prev) => ({ ...prev, [productId]: false }));
    }, 2600);
  }, []);

  const loadProductsForShop = useCallback(
    async (shop: Shop) => {
      try {
        const data = await apiClient.get(`/shops/${shop.shop_id}/products`, token!);
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load products:', err);
        setProducts([]);
      }
    },
    [token]
  );

  const selectShop = useCallback(
    async (shop: Shop) => {
      setSelectedShop(shop);
      setApiShopMetrics(null);
      await loadProductsForShop(shop);
      try {
        const metrics = await apiClient.get(`/shop-owner/shops/${shop.shop_id}/metrics`, token!);
        setApiShopMetrics(metrics as Record<string, unknown>);
      } catch {
        setApiShopMetrics(null);
      }
    },
    [token, loadProductsForShop]
  );

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/shop-owner/shops', token!);
      const shopList = Array.isArray(data) ? data : [];
      setShops(shopList);
      if (shopList.length > 0) {
        await selectShop(shopList[0] as Shop);
      } else {
        setSelectedShop(null);
        setProducts([]);
        setApiShopMetrics(null);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to load shops';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, selectShop]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'shop_owner') {
      router.push('/');
      return;
    }
    void fetchShops();
  }, [isAuthenticated, user, router, fetchShops]);

  useEffect(() => {
    if (newShop.addressQuery.trim().length < 3) {
      setShopSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setShopSuggestLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=pk&q=${encodeURIComponent(
            newShop.addressQuery
          )}`,
          {
            signal: controller.signal,
            headers: { Accept: 'application/json', 'Accept-Language': 'en-PK,en;q=0.9' },
          }
        );
        if (!res.ok) throw new Error('search failed');
        setShopSuggestions((await res.json()) as NominatimSuggestion[]);
      } catch {
        setShopSuggestions([]);
      } finally {
        setShopSuggestLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [newShop.addressQuery]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name.trim() || !newShop.latitude || !newShop.longitude || !newShop.address.trim()) {
      alert('Please fill shop name and pick a full address from suggestions (Pakistan).');
      return;
    }
    setCreateShopLoading(true);
    try {
      await apiClient.post(
        '/shop-owner/shops',
        {
          name: newShop.name.trim(),
          location: {
            address: newShop.address.trim(),
            latitude: parseFloat(newShop.latitude),
            longitude: parseFloat(newShop.longitude),
          },
        },
        token!
      );
      setShowCreateShop(false);
      setNewShop({ name: '', addressQuery: '', address: '', latitude: '', longitude: '' });
      setShopSuggestions([]);
      await fetchShops();
      showSuccess('Shop created successfully ✓');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to create shop. Check API expects POST /shop-owner/shops with name + location.';
      alert(msg);
    } finally {
      setCreateShopLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !newProduct.name || !newProduct.price) {
      alert('Please fill in required fields');
      return;
    }
    const stockRaw = newProduct.stock_quantity.trim();
    const stockQty = stockRaw === '' ? 0 : parseInt(stockRaw, 10);
    if (Number.isNaN(stockQty) || stockQty < 0) {
      alert('Stock quantity must be zero or a positive whole number.');
      return;
    }

    const discRaw = newProduct.discount_percent.trim();
    const disc = discRaw === '' ? 0 : parseFloat(discRaw);
    if (Number.isNaN(disc) || disc < 0 || disc > 100) {
      alert('Discount must be between 0 and 100%.');
      return;
    }

    try {
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        category: newProduct.category,
        price: parseFloat(newProduct.price),
        stock_quantity: stockQty,
        discount_percent: disc,
        is_active: true,
      };

      await apiClient.post(`/shop-owner/shops/${selectedShop.shop_id}/products`, productData, token!);

      showSuccess('Product added successfully ✓');
      setNewProduct({ name: '', description: '', category: '', price: '', stock_quantity: '', discount_percent: '' });
      setShowNewProduct(false);
      await loadProductsForShop(selectedShop);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to add product';
      alert(msg);
    }
  };

  const shopViews = selectedShop ? readLocalInt(`easysamaan_shop_views_${selectedShop.shop_id}`) : 0;
  const shopSales = selectedShop ? readLocalInt(`easysamaan_shop_sales_${selectedShop.shop_id}`) : 0;

  const applyProductDiscount = async (product: Product) => {
    if (!token) {
      alert('Your session expired. Sign in again.');
      return;
    }
    const raw = (discountDrafts[product.product_id] ?? String(product.discount_percent ?? 0)).trim();
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      alert('Discount must be between 0 and 100.');
      return;
    }
    try {
      const id = encodeURIComponent(product.product_id);
      await apiClient.patch(`/shop-owner/products/${id}`, { discount_percent: n }, token);
      setDiscountDrafts((d) => {
        const next = { ...d };
        delete next[product.product_id];
        return next;
      });
      flashProductTick(product.product_id);
      showSuccess(`Discount updated for ${product.name} ✓`);
      if (selectedShop) await loadProductsForShop(selectedShop);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to update discount';
      alert(msg);
    }
  };

  const restockProduct = async (product: Product) => {
    if (!token) {
      alert('Your session expired. Sign in again.');
      return;
    }
    const raw = (restockDrafts[product.product_id] ?? '').trim();
    const addQty = parseInt(raw, 10);
    if (!raw || Number.isNaN(addQty) || addQty <= 0) {
      alert('Enter a positive whole number to restock.');
      return;
    }
    const current = product.stock_quantity ?? 0;
    try {
      const id = encodeURIComponent(product.product_id);
      await apiClient.patch(`/shop-owner/products/${id}`, { stock_quantity: current + addQty }, token);
      setRestockDrafts((d) => {
        const next = { ...d };
        delete next[product.product_id];
        return next;
      });
      flashProductTick(product.product_id);
      showSuccess(`Stock updated for ${product.name} ✓`);
      if (selectedShop) await loadProductsForShop(selectedShop);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to restock product';
      alert(msg);
    }
  };

  const reduceStock = async (product: Product) => {
    if (!token) {
      alert('Your session expired. Sign in again.');
      return;
    }
    const raw = (reduceDrafts[product.product_id] ?? '').trim();
    const dropQty = parseInt(raw, 10);
    if (!raw || Number.isNaN(dropQty) || dropQty <= 0) {
      alert('Enter a positive whole number of units to remove from stock.');
      return;
    }
    const current = product.stock_quantity ?? 0;
    if (dropQty > current) {
      alert(`You only have ${current} in stock. Enter ${current} or less.`);
      return;
    }
    try {
      const id = encodeURIComponent(product.product_id);
      const newQty = Math.max(0, current - dropQty);
      await apiClient.patch(`/shop-owner/products/${id}`, { stock_quantity: newQty }, token);
      setReduceDrafts((d) => {
        const next = { ...d };
        delete next[product.product_id];
        return next;
      });
      flashProductTick(product.product_id);
      showSuccess(`Stock reduced for ${product.name} ✓`);
      if (selectedShop) await loadProductsForShop(selectedShop);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to reduce stock';
      alert(msg);
    }
  };

  const restoreProductToCatalog = async (product: Product) => {
    if (!token) {
      alert('Your session expired. Sign in again.');
      return;
    }
    try {
      const id = encodeURIComponent(product.product_id);
      await apiClient.patch(`/shop-owner/products/${id}`, { is_active: true }, token);
      showSuccess(`${product.name} is live again ✓`);
      if (selectedShop) await loadProductsForShop(selectedShop);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to restore product';
      alert(msg);
    }
  };

  const deleteProductFromCatalog = async (product: Product) => {
    if (!token) {
      alert('Your session expired. Sign in again.');
      return;
    }
    const ok = window.confirm(
      `Remove "${product.name}" from your catalog?\n\nCustomers will not see it anymore (marked inactive). You can use Restore if you change your mind.`
    );
    if (!ok) return;
    try {
      const id = encodeURIComponent(product.product_id);
      await apiClient.delete(`/shop-owner/products/${id}`, token);
      showSuccess(`${product.name} removed from storefront ✓`);
      if (selectedShop) await loadProductsForShop(selectedShop);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to remove product';
      alert(msg);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fff7ed] text-black">
      <main
        className="mx-auto max-w-6xl px-6 py-10 text-black md:px-8"
        style={{ backgroundImage: "linear-gradient(to bottom, rgba(255,247,237,0.92), rgba(255,255,255,0.96)), url('/shop-owner-dashboard-bg.svg')", backgroundSize: 'cover' }}
      >
        <section className="mb-8 rounded-3xl border border-[#ffd7b0] bg-white/85 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-2 inline-flex items-center rounded-full bg-[#fff0df] px-3 py-1 text-xs font-bold text-[#9a4f00]">
            Shop Owner Dashboard
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1E1E1E]">Store Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-black/70">Manage products, pricing, stock and performance with a cleaner orange-and-white workflow.</p>
        </section>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-black">Shops & Products</h2>
          <button
            type="button"
            onClick={() => setShowCreateShop(true)}
            className="rounded-xl bg-[#FF8D28] px-6 py-2.5 font-semibold text-black shadow transition hover:bg-[#f37300]"
          >
            Create shop
          </button>
        </div>

        {error && <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700">{error}</div>}
        {successMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">✓</span>
            <span className="text-sm font-semibold">{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-black/60">Loading...</div>
        ) : shops.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
            <p className="mb-2 text-lg font-semibold text-black">You have not created any shops yet</p>
            <p className="mb-6 text-sm text-black/70">Create your first shop, then add products. You can own multiple shops.</p>
            <button
              type="button"
              onClick={() => setShowCreateShop(true)}
              className="rounded-xl bg-[#FF8D28] px-8 py-3 font-bold text-black hover:bg-[#f37300]"
            >
              Create shop
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <h2 className="mb-4 text-lg font-bold text-black">My shops</h2>
              <div className="space-y-2">
                {shops.map((shop) => (
                  <button
                    key={shop.shop_id}
                    type="button"
                    onClick={() => void selectShop(shop)}
                    className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                      selectedShop?.shop_id === shop.shop_id
                        ? 'bg-[#FF8D28] font-semibold text-black'
                        : 'bg-white text-black shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    {shop.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              {selectedShop && (
                <>
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-black">{selectedShop.name}</h2>
                      <p className="text-sm text-black/75">{selectedShop.location.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewProduct(!showNewProduct)}
                      className="rounded-xl bg-[#FF8D28] px-6 py-2 font-semibold text-black hover:bg-[#f37300]"
                    >
                      {showNewProduct ? 'Cancel' : 'Add product'}
                    </button>
                  </div>

                  <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/60">Products</p>
                      <p className="mt-1 text-2xl font-bold text-black">{products.length}</p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/60">Est. units sold (this browser)</p>
                      <p className="mt-1 text-2xl font-bold text-black">{shopSales}</p>
                      <p className="mt-1 text-xs text-black/55">From completed checkouts on this device</p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/60">Product page opens (this browser)</p>
                      <p className="mt-1 text-2xl font-bold text-black">{shopViews}</p>
                      <p className="mt-1 text-xs text-black/55">Approximate interest signal until backend analytics exist</p>
                    </div>
                  </div>

                  {apiShopMetrics && (
                    <div className="mb-8 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-black">
                      <p className="font-semibold text-black">Live metrics (API)</p>
                      <pre className="mt-2 max-h-32 overflow-auto text-xs text-black/90">{JSON.stringify(apiShopMetrics, null, 2)}</pre>
                    </div>
                  )}

                  {showNewProduct && (
                    <form
                      onSubmit={handleAddProduct}
                      className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
                    >
                      <h3 className="mb-4 text-lg font-bold text-black">Add new product</h3>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="new-product-name" className="mb-2 block text-sm font-semibold text-black">
                            Product name *
                          </label>
                          <input
                            id="new-product-name"
                            type="text"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            required
                            autoComplete="off"
                            placeholder="e.g. Basmati rice 5kg"
                            className="w-full rounded-lg border-2 border-neutral-300 px-4 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="new-product-price" className="mb-2 block text-sm font-semibold text-black">
                            Price (Rs.) *
                          </label>
                          <input
                            id="new-product-price"
                            type="number"
                            step="0.01"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                            required
                            className="w-full rounded-lg border-2 border-neutral-300 px-4 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label htmlFor="new-product-stock" className="mb-2 block text-sm font-semibold text-black">
                            Stock quantity *
                          </label>
                          <input
                            id="new-product-stock"
                            type="number"
                            min={0}
                            step={1}
                            value={newProduct.stock_quantity}
                            onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                            required
                            className="w-full rounded-lg border-2 border-neutral-300 px-4 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                            placeholder="How many units to stock"
                          />
                          <p className="mt-1 text-xs text-black/55">Customers see this count; use 0 to mark sold out.</p>
                        </div>

                        <div>
                          <label htmlFor="new-product-discount" className="mb-2 block text-sm font-semibold text-black">
                            Discount (%)
                          </label>
                          <input
                            id="new-product-discount"
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={newProduct.discount_percent}
                            onChange={(e) => setNewProduct({ ...newProduct, discount_percent: e.target.value })}
                            className="w-full rounded-lg border-2 border-neutral-300 px-4 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                            placeholder="0 = no discount"
                          />
                          <p className="mt-1 text-xs text-black/55">Sale price = list price minus this percentage.</p>
                        </div>

                        <div>
                          <label htmlFor="new-product-category" className="mb-2 block text-sm font-semibold text-black">
                            Category
                          </label>
                          <input
                            id="new-product-category"
                            type="text"
                            value={newProduct.category}
                            onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                            placeholder="Groceries, Electronics…"
                            className="w-full rounded-lg border-2 border-neutral-300 px-4 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="new-product-description" className="mb-2 block text-sm font-semibold text-black">
                            Description
                          </label>
                          <input
                            id="new-product-description"
                            type="text"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                            placeholder="Short line for customers"
                            className="w-full rounded-lg border-2 border-neutral-300 px-4 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="mt-4 w-full rounded-lg bg-[#FF8D28] px-6 py-2.5 font-semibold text-black transition-colors hover:bg-[#f37300]"
                      >
                        Add product
                      </button>
                    </form>
                  )}

                  <div>
                    <h3 className="mb-4 text-lg font-bold text-black">Product performance</h3>
                    {products.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-black/65">
                        No products yet. Add your first product.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                        <table className="w-full min-w-[960px] text-left text-sm text-black">
                          <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-black/70">
                            <tr>
                              <th className="px-4 py-3">Product</th>
                              <th className="px-4 py-3">List price</th>
                              <th className="px-4 py-3">Discount %</th>
                              <th className="px-4 py-3">Sale price</th>
                              <th className="px-4 py-3">Stock</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Sales (est.)</th>
                              <th className="px-4 py-3">Views (est.)</th>
                              <th className="px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((product) => {
                              const apiSold = product.total_sold ?? product.units_sold;
                              const localSold = readLocalInt(`easysamaan_product_sales_${product.product_id}`);
                              const localViews = readLocalInt(`easysamaan_product_views_${product.product_id}`);
                              const draft =
                                discountDrafts[product.product_id] ??
                                (product.discount_percent != null ? String(product.discount_percent) : '0');
                              const restockDraft = restockDrafts[product.product_id] ?? '';
                              const reduceDraft = reduceDrafts[product.product_id] ?? '';
                              return (
                                <tr key={product.product_id} className="border-b border-neutral-100 last:border-0">
                                  <td className="px-4 py-3 font-medium text-black">{product.name}</td>
                                  <td className="px-4 py-3 font-semibold tabular-nums text-black">Rs. {product.price}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        value={draft}
                                        onChange={(e) =>
                                          setDiscountDrafts((d) => ({ ...d, [product.product_id]: e.target.value }))
                                        }
                                        className="w-16 rounded border border-neutral-300 px-1 py-1 text-sm text-black"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => void applyProductDiscount(product)}
                                        className="rounded bg-[#FF8D28] px-2 py-1 text-xs font-semibold text-black hover:bg-[#f37300]"
                                      >
                                        Apply
                                      </button>
                                      {productTicks[product.product_id] && (
                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-semibold tabular-nums text-black">
                                    Rs. {getDisplayPrice(product)}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-black">
                                    <div className="space-y-2">
                                      <div>
                                        {product.stock_quantity != null ? (
                                          product.stock_quantity === 0 ? (
                                            <span className="font-semibold text-red-700">0 (sold out)</span>
                                          ) : (
                                            product.stock_quantity
                                          )
                                        ) : (
                                          <span className="text-black/50">—</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1">
                                        <input
                                          type="number"
                                          min={1}
                                          step={1}
                                          value={restockDraft}
                                          onChange={(e) =>
                                            setRestockDrafts((d) => ({ ...d, [product.product_id]: e.target.value }))
                                          }
                                          className="w-20 rounded border border-neutral-300 px-1 py-1 text-sm text-black"
                                          placeholder="+qty"
                                          aria-label={`Restock quantity for ${product.name}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void restockProduct(product)}
                                          className="rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-semibold text-black hover:bg-neutral-100"
                                        >
                                          Restock
                                        </button>
                                        {productTicks[product.product_id] && (
                                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1">
                                        <input
                                          type="number"
                                          min={1}
                                          step={1}
                                          value={reduceDraft}
                                          onChange={(e) =>
                                            setReduceDrafts((d) => ({ ...d, [product.product_id]: e.target.value }))
                                          }
                                          className="w-20 rounded border border-neutral-300 px-1 py-1 text-sm text-black"
                                          placeholder="-qty"
                                          aria-label={`Reduce stock quantity for ${product.name}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void reduceStock(product)}
                                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-black hover:bg-amber-100"
                                        >
                                          Reduce
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={
                                        product.is_active
                                          ? 'inline-flex rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-black'
                                          : 'inline-flex rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-black/70'
                                      }
                                    >
                                      {product.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-black">
                                    {apiSold != null ? apiSold : localSold}
                                    {apiSold == null && <span className="ml-1 text-xs text-black/50">(local)</span>}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-black">
                                    {localViews}
                                    <span className="ml-1 text-xs text-black/50">(local)</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      {product.is_active ? (
                                        <button
                                          type="button"
                                          onClick={() => void deleteProductFromCatalog(product)}
                                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
                                          title="Remove from customer catalog"
                                        >
                                          Delete
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => void restoreProductToCatalog(product)}
                                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-black hover:bg-neutral-50"
                                          title="Show again to customers"
                                        >
                                          Restore
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showCreateShop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-black shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-black">Create shop</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateShop(false);
                    setNewShop({ name: '', addressQuery: '', address: '', latitude: '', longitude: '' });
                    setShopSuggestions([]);
                  }}
                  className="text-2xl leading-none text-black/50 hover:text-black"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateShop} className="space-y-4">
                <div>
                  <label htmlFor="create-shop-name" className="mb-1 block text-sm font-semibold text-black">
                    Shop name *
                  </label>
                  <p className="mb-2 text-xs text-black/60">This is the name customers see in listings.</p>
                  <input
                    id="create-shop-name"
                    type="text"
                    value={newShop.name}
                    onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                    required
                    autoComplete="organization"
                    className="w-full rounded-lg border-2 border-neutral-300 px-3 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                    placeholder="e.g. Fresh Mart Gulberg"
                  />
                </div>
                <div>
                  <label htmlFor="create-shop-location-search" className="mb-1 block text-sm font-semibold text-black">
                    Shop location (address in Pakistan) *
                  </label>
                  <p className="mb-2 text-xs text-black/60">
                    Type street, area, or city. Choose one result below — that sets your shop coordinates.
                  </p>
                  <input
                    id="create-shop-location-search"
                    type="text"
                    value={newShop.addressQuery}
                    onChange={(e) =>
                      setNewShop({
                        ...newShop,
                        addressQuery: e.target.value,
                        address: '',
                        latitude: '',
                        longitude: '',
                      })
                    }
                    className="w-full rounded-lg border-2 border-neutral-300 px-3 py-2 text-black placeholder:text-black/40 focus:border-[#FF8D28] focus:outline-none"
                    placeholder="Search: e.g. MM Alam Road Lahore"
                    autoComplete="street-address"
                  />
                  {shopSuggestLoading && <p className="mt-1 text-xs text-black/55">Searching…</p>}
                  {shopSuggestions.length > 0 && (
                    <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 text-sm" role="listbox" aria-label="Address suggestions">
                      {shopSuggestions.map((s) => (
                        <li key={s.place_id}>
                          <button
                            type="button"
                            className="w-full border-b border-neutral-200 px-3 py-2.5 text-left text-black last:border-b-0 hover:bg-white"
                            onClick={() =>
                              setNewShop({
                                ...newShop,
                                address: s.display_name,
                                latitude: Number(s.lat).toFixed(6),
                                longitude: Number(s.lon).toFixed(6),
                                addressQuery: s.display_name,
                              })
                            }
                          >
                            {s.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {newShop.address && newShop.latitude && (
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Selected location</p>
                      <p className="mt-1 text-sm text-black">{newShop.address}</p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-black/55">You must pick a suggestion so latitude and longitude are filled.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="create-shop-lat" className="mb-1 block text-xs font-semibold text-black">
                      Latitude
                    </label>
                    <input
                      id="create-shop-lat"
                      readOnly
                      value={newShop.latitude}
                      className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-2 text-sm text-black"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-shop-lon" className="mb-1 block text-xs font-semibold text-black">
                      Longitude
                    </label>
                    <input
                      id="create-shop-lon"
                      readOnly
                      value={newShop.longitude}
                      className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-2 text-sm text-black"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateShop(false);
                      setNewShop({ name: '', addressQuery: '', address: '', latitude: '', longitude: '' });
                      setShopSuggestions([]);
                    }}
                    className="flex-1 rounded-lg border border-neutral-300 py-2 font-semibold text-black hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createShopLoading}
                    className="flex-1 rounded-lg bg-[#FF8D28] py-2 font-bold text-black disabled:opacity-50"
                  >
                    {createShopLoading ? 'Creating…' : 'Create shop'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
