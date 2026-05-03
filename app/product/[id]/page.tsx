'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { Product } from '../../lib/types';
import { DEMO_PRODUCTS, getDemoProductById } from '../../lib/demo-products';
import { getDisplayPrice, hasActiveDiscount } from '../../lib/pricing';
import { getProductImageUrl } from '../../lib/product-images';
import Link from 'next/link';

interface CartItem {
  product_id: string;
  shop_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Review {
  review_id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

function productIsSoldOut(p: Product | null): boolean {
  if (!p) return true;
  return typeof p.stock_quantity === "number" && p.stock_quantity <= 0;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const { token, user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [moreFromShop, setMoreFromShop] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await apiClient.get(`/products/${productId}`, token || undefined);
        setProduct(data);
      } catch (err) {
        console.error(err);
        if (!token) {
          const demo = getDemoProductById(productId);
          if (demo) {
            setProduct(demo);
            setError('');
          } else {
            setError('Failed to load product');
          }
        } else {
          setError('Failed to load product');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, token]);

  useEffect(() => {
    if (!product || typeof product.stock_quantity !== "number" || product.stock_quantity <= 0) return;
    setQuantity((q) => Math.min(Math.max(1, q), product.stock_quantity!));
  }, [product?.product_id, product?.stock_quantity]);

  useEffect(() => {
    if (!product?.shop_id || !product.product_id) return;
    try {
      const shopKey = `easysamaan_shop_views_${product.shop_id}`;
      const productKey = `easysamaan_product_views_${product.product_id}`;
      localStorage.setItem(shopKey, String(parseInt(localStorage.getItem(shopKey) || '0', 10) + 1));
      localStorage.setItem(productKey, String(parseInt(localStorage.getItem(productKey) || '0', 10) + 1));
    } catch {
      /* ignore */
    }
  }, [product?.shop_id, product?.product_id]);

  useEffect(() => {
    setImageError(false);
  }, [product?.product_id, product?.name]);

  useEffect(() => {
    const loadRelated = async () => {
      if (!product?.shop_id || !product?.product_id) return;
      try {
        const list = (await apiClient.get(`/shops/${product.shop_id}/products`, token || undefined)) as Product[];
        setMoreFromShop(list.filter((p) => p.product_id !== product.product_id).slice(0, 6));
      } catch {
        if (!token) {
          setMoreFromShop(
            DEMO_PRODUCTS.filter((p) => p.shop_id === product.shop_id && p.product_id !== product.product_id).slice(0, 6)
          );
        } else {
          setMoreFromShop([]);
        }
      }
    };
    void loadRelated();
  }, [product?.shop_id, product?.product_id, token]);

  const loadReviews = async () => {
    if (!productId) return;
    try {
      const data = (await apiClient.get(`/products/${productId}/reviews`, token || undefined)) as Review[];
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      setReviews([]);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [productId, token]);

  const handleAddToCart = () => {
    if (!user || user.role !== 'customer') {
      alert('Please log in as a customer to add items to cart.');
      router.push('/login');
      return;
    }
    if (!product || productIsSoldOut(product)) return;
    const cap = typeof product.stock_quantity === "number" ? product.stock_quantity : Number.POSITIVE_INFINITY;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]') as CartItem[];
    const existingItem = cart.find((item) => item.product_id === product.product_id);
    const already = existingItem?.quantity ?? 0;
    if (already + quantity > cap) {
      alert(`Only ${cap} units available for this product. You already have ${already} in the cart.`);
      return;
    }

    const unit = getDisplayPrice(product);
    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.price = unit;
    } else {
      cart.push({
        product_id: product.product_id,
        shop_id: product.shop_id,
        name: product.name,
        price: unit,
        quantity,
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart:update'));
    alert('Added to cart!');
    setQuantity(1);
  };

  const stockCap = product && typeof product.stock_quantity === "number" ? product.stock_quantity : null;

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user || user.role !== 'customer') {
      alert('Sign in as a customer to add a review.');
      return;
    }
    setReviewSubmitting(true);
    try {
      await apiClient.post(
        `/products/${productId}/reviews`,
        { rating: reviewRating, comment: reviewComment.trim() || null },
        token
      );
      setReviewComment('');
      setReviewRating(5);
      await loadReviews();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to add review';
      alert(msg);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-black/70">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Product not found'}</p>
          <Link href="/shop" className="font-semibold text-black underline-offset-4 hover:underline">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-6xl mx-auto py-12 px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div>
            <div className="w-full h-96 bg-[#E3E3E3] rounded-lg flex items-center justify-center">
              {imageError ? (
                <span className="text-[#757575]">Product Image</span>
              ) : (
                <img
                  src={getProductImageUrl(product.name)}
                  alt={product.name}
                  className="h-full w-full rounded-lg object-cover"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          </div>

          {/* Product Details */}
          <div>
            <h1 className="mb-2 text-3xl font-bold text-black">{product.name}</h1>
            <Link
              href={`/shop/${product.shop_id}`}
              className="mb-3 inline-block text-sm font-semibold text-[#FF8D28] hover:underline"
            >
              Visit this shop
            </Link>
            
            {product.category && (
              <span className="mb-4 inline-block rounded px-3 py-1 text-sm font-semibold text-black ring-1 ring-neutral-300 bg-neutral-50">
                {product.category}
              </span>
            )}

            <div className="mb-2 flex flex-wrap items-end gap-3">
              <div className="text-4xl font-bold text-black">
                Rs. <span className="text-5xl text-black">{getDisplayPrice(product)}</span>
              </div>
              {hasActiveDiscount(product) && (
                <div className="pb-1 text-lg text-black/50 line-through">Rs. {product.price}</div>
              )}
              {hasActiveDiscount(product) && (
                <span className="mb-1 rounded-full bg-black px-2 py-0.5 text-xs font-bold text-white">
                  {Math.round(product.discount_percent ?? 0)}% off
                </span>
              )}
            </div>

            <p className="mb-6 text-black/80">{product.description || 'No description available'}</p>

            <div className="mb-6">
              {productIsSoldOut(product) ? (
                <p className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm font-semibold text-black">
                  Sold out — check back later.
                </p>
              ) : stockCap != null ? (
                <p className="text-sm font-semibold text-black">
                  <span className="text-black/70">In stock:</span> {stockCap} units
                </p>
              ) : null}
            </div>

            {/* Quantity Selector */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-black">Quantity</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  disabled={productIsSoldOut(product)}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="rounded-lg bg-neutral-100 px-4 py-2 text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  disabled={productIsSoldOut(product)}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10) || 1;
                    const max = stockCap ?? n;
                    setQuantity(Math.max(1, Math.min(n, max)));
                  }}
                  className="w-16 rounded-lg border-2 border-neutral-300 px-2 py-2 text-center text-black disabled:opacity-40"
                />
                <button
                  type="button"
                  disabled={productIsSoldOut(product) || (stockCap != null && quantity >= stockCap)}
                  onClick={() => setQuantity(quantity + 1)}
                  className="rounded-lg bg-neutral-100 px-4 py-2 text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={productIsSoldOut(product)}
              className="mb-6 w-full rounded-lg bg-[#FF8D28] px-6 py-3 font-bold text-black transition-colors hover:bg-[#f37300] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {productIsSoldOut(product) ? 'Sold out' : 'Add To Cart'}
            </button>

            {/* Description */}
            {product.description && (
              <details className="border-t-2 border-neutral-200">
                <summary className="cursor-pointer py-4 font-bold text-black transition-colors hover:text-black/80">
                  Description
                </summary>
                <div className="pb-4 text-black/80">
                  <p>{product.description}</p>
                </div>
              </details>
            )}

            <section className="mt-6 rounded-2xl border border-neutral-200 bg-[#fff9f3] p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-black">Add a Review</h2>
              {user?.role === 'customer' ? (
                <form onSubmit={handleAddReview} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-black">Rating</label>
                    <div className="flex items-center gap-1 rounded-xl bg-white p-2 ring-1 ring-neutral-200">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-label={`${n} star${n > 1 ? 's' : ''}`}
                          onClick={() => setReviewRating(n)}
                          className={`text-2xl leading-none transition-transform hover:scale-110 ${
                            n <= reviewRating ? 'text-[#FF8D28]' : 'text-neutral-300'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-semibold text-black/70">{reviewRating}/5</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-black">Comment</label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={3}
                      placeholder="Share your experience..."
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-black outline-none focus:border-[#FF8D28]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="rounded-lg bg-[#FF8D28] px-4 py-2 font-semibold text-black hover:bg-[#f37300] disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-black/70">Sign in as a customer to add a review.</p>
              )}

              <div className="mt-4 space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-sm text-black/70">No reviews yet.</p>
                ) : (
                  reviews.slice(0, 5).map((r) => (
                    <div key={r.review_id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <p className="text-sm font-semibold text-black">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                      {r.comment && <p className="mt-1 text-sm text-black/80">{r.comment}</p>}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-black">More from this Shop</h2>
          {moreFromShop.length === 0 ? (
            <p className="text-black/70">No more products from this shop yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {moreFromShop.map((p) => (
                <div
                  key={p.product_id}
                  className="rounded-xl border border-neutral-200 p-4 transition-colors hover:border-[#FF8D28]"
                >
                  <Link href={`/product/${p.product_id}`} className="block">
                    <p className="font-semibold text-black">{p.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-black/70">{p.description || 'No description'}</p>
                    <p className="mt-2 font-bold text-black">Rs. {getDisplayPrice(p)}</p>
                  </Link>
                  <Link
                    href={`/shop/${p.shop_id}`}
                    className="mt-3 inline-block rounded-lg bg-[#FFF4E5] px-3 py-1.5 text-xs font-semibold text-[#c25a00] ring-1 ring-[#ffd8b2] transition-colors hover:bg-[#ffe7cc]"
                  >
                    Visit Shop
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
