'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { Product, Shop } from '../../lib/types';
import { getDisplayPrice, hasActiveDiscount } from '../../lib/pricing';

export default function ShopDetailsPage() {
  const params = useParams();
  const shopId = params.id as string;
  const { token } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [shopData, productsData] = await Promise.all([
          apiClient.get(`/shops/${shopId}`, token || undefined),
          apiClient.get(`/shops/${shopId}/products`, token || undefined),
        ]);
        setShop(shopData as Shop);
        setProducts(Array.isArray(productsData) ? (productsData as Product[]) : []);
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
            ? (err as { message: string }).message
            : 'Failed to load shop';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [shopId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <main className="mx-auto max-w-6xl px-8">
          <p className="text-black/70">Loading shop...</p>
        </main>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-white py-12">
        <main className="mx-auto max-w-6xl px-8">
          <p className="mb-3 text-red-600">{error || 'Shop not found'}</p>
          <Link href="/shop" className="font-semibold text-[#FF8D28] hover:underline">
            Back to shop
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12">
      <main className="mx-auto max-w-6xl px-8">
        <Link href="/shop" className="text-sm font-semibold text-[#FF8D28] hover:underline">
          ← Back to all shops
        </Link>
        <section className="mt-4 overflow-hidden rounded-3xl border border-[#ffd8b2] bg-gradient-to-r from-[#fff4e5] via-[#fff9f3] to-[#ffe9cf] p-6 shadow-[0_10px_30px_rgba(243,115,0,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c25a00]">Shop</p>
          <h1 className="mt-2 text-3xl font-bold text-black">{shop.name}</h1>
          <p className="mt-2 max-w-3xl rounded-xl bg-white/70 px-3 py-2 text-sm text-black/75 ring-1 ring-[#ffd8b2]">
            {shop.location?.address || 'Address unavailable'}
          </p>
        </section>

        <h2 className="mt-8 mb-4 text-xl font-bold text-black">Products</h2>
        {products.length === 0 ? (
          <p className="text-black/70">No active products in this shop yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.product_id}
                href={`/product/${p.product_id}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-[#FF8D28]"
              >
                <h3 className="font-semibold text-black">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-black/70">{p.description || 'No description'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-lg font-bold text-black">Rs. {getDisplayPrice(p)}</p>
                  {hasActiveDiscount(p) && (
                    <span className="text-sm text-black/50 line-through">Rs. {p.price}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
