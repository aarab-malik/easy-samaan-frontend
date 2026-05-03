'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { apiClient } from '../lib/api-client';
import Link from 'next/link';
import { HiMapPin } from 'react-icons/hi2';
import { appendPlacedOrder } from '../lib/customer-orders-local';

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface CartItem {
  product_id: string;
  shop_id: string;
  name: string;
  price: number;
  quantity: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function CheckoutPage() {
  const router = useRouter();
  const { token, isAuthenticated, user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [shopNameById, setShopNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user && (user.role === 'shop_owner' || user.role === 'rider')) {
      router.replace('/');
      return;
    }

    const cart = JSON.parse(localStorage.getItem('cart') || '[]') as CartItem[];
    // Remove stale/demo IDs from older guest sessions; backend accepts UUID product IDs.
    const cleaned = cart.filter((item) => UUID_RE.test(item.product_id));
    if (cleaned.length !== cart.length) {
      localStorage.setItem('cart', JSON.stringify(cleaned));
      window.dispatchEvent(new Event('cart:update'));
      setError('Removed old sample items from cart. Please review your checkout items.');
    }
    setCartItems(cleaned);
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!token || cartItems.length === 0) {
      setShopNameById({});
      return;
    }
    const uniqueShopIds = Array.from(new Set(cartItems.map((item) => item.shop_id)));
    let cancelled = false;
    const loadShopNames = async () => {
      try {
        const entries = await Promise.all(
          uniqueShopIds.map(async (shopId) => {
            const shop = (await apiClient.get(`/shops/${shopId}`, token)) as { name?: string };
            return [shopId, shop?.name || 'Unknown shop'] as const;
          })
        );
        if (!cancelled) {
          setShopNameById(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) setShopNameById({});
      }
    };
    void loadShopNames();
    return () => {
      cancelled = true;
    };
  }, [cartItems, token]);

  useEffect(() => {
    if (deliveryLocation.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=pk&q=${encodeURIComponent(
            deliveryLocation
          )}`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'Accept-Language': 'en-PK,en;q=0.9',
            },
          }
        );
        if (!response.ok) {
          throw new Error('Failed to fetch location suggestions');
        }
        const data = (await response.json()) as NominatimSuggestion[];
        setSuggestions(data);
        setShowSuggestions(true);
        setActiveSuggestionIndex(data.length > 0 ? 0 : -1);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deliveryLocation]);

  const handleSuggestionSelect = (suggestion: NominatimSuggestion) => {
    setDeliveryLocation(suggestion.display_name);
    setLatitude(Number(suggestion.lat).toFixed(6));
    setLongitude(Number(suggestion.lon).toFixed(6));
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const fetchTopSuggestion = async (query: string): Promise<NominatimSuggestion | null> => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=pk&q=${encodeURIComponent(
        query
      )}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en-PK,en;q=0.9',
        },
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimSuggestion[];
    return data.length > 0 ? data[0] : null;
  };

  const syncCartToStorage = (items: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(items));
    window.dispatchEvent(new Event('cart:update'));
  };

  const handleRemoveItem = (productId: string) => {
    const updatedItems = cartItems.filter((item) => item.product_id !== productId);
    setCartItems(updatedItems);
    syncCartToStorage(updatedItems);
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    const updatedItems = cartItems
      .map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      )
      .filter((item) => item.quantity > 0);
    setCartItems(updatedItems);
    syncCartToStorage(updatedItems);
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let resolvedAddress = deliveryLocation;
    let resolvedLatitude = latitude;
    let resolvedLongitude = longitude;

    if (!deliveryLocation) {
      setError('Please fill in all delivery details');
      setLoading(false);
      return;
    }

    if (!latitude || !longitude) {
      const topSuggestion = await fetchTopSuggestion(deliveryLocation);
      if (topSuggestion) {
        resolvedAddress = topSuggestion.display_name;
        resolvedLatitude = Number(topSuggestion.lat).toFixed(6);
        resolvedLongitude = Number(topSuggestion.lon).toFixed(6);
        setDeliveryLocation(resolvedAddress);
        setLatitude(resolvedLatitude);
        setLongitude(resolvedLongitude);
      } else {
        setError('Please select a valid Pakistan address from suggestions');
        setLoading(false);
        return;
      }
    }

    if (cartItems.length === 0) {
      setError('Your cart is empty');
      setLoading(false);
      return;
    }

    try {
      const orderData = {
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        delivery_location: {
          latitude: parseFloat(resolvedLatitude),
          longitude: parseFloat(resolvedLongitude),
          address: resolvedAddress,
        },
        confirm: true,
      };

      const orderResponse: unknown = await apiClient.post('/customer/orders', orderData, token!);
      let orderId = `local-${Date.now()}`;
      if (
        orderResponse &&
        typeof orderResponse === 'object' &&
        orderResponse !== null &&
        'order_id' in orderResponse &&
        typeof (orderResponse as { order_id: unknown }).order_id === 'string'
      ) {
        orderId = (orderResponse as { order_id: string }).order_id;
      }
      appendPlacedOrder({
        order_id: orderId,
        delivery_location: {
          latitude: parseFloat(resolvedLatitude),
          longitude: parseFloat(resolvedLongitude),
          address: resolvedAddress,
        },
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        total_amount: totalAmount,
        created_at: new Date().toISOString(),
        fulfillment_status: 'placed',
      });
      cartItems.forEach((item) => {
        const shopKey = `easysamaan_shop_sales_${item.shop_id}`;
        const productKey = `easysamaan_product_sales_${item.product_id}`;
        localStorage.setItem(shopKey, String(parseInt(localStorage.getItem(shopKey) || '0', 10) + item.quantity));
        localStorage.setItem(productKey, String(parseInt(localStorage.getItem(productKey) || '0', 10) + item.quantity));
      });
      syncCartToStorage([]);
      alert('Order placed successfully!');
      router.push('/');
    } catch (err: unknown) {
      const errorMessage =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to place order';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }
  if (user && (user.role === 'shop_owner' || user.role === 'rider')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-6xl mx-auto py-12 px-8">
        <h1 className="text-3xl font-bold text-[#1E1E1E] mb-8">Checkout</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#757575] mb-4">Your cart is empty</p>
            <Link href="/shop" className="text-[#FF8D28] font-semibold hover:underline">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white border-2 border-[#D9D9D9] rounded-lg p-6">
                <h2 className="text-xl font-bold text-[#1E1E1E] mb-4">Order Summary</h2>
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.product_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/product/${item.product_id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/product/${item.product_id}`);
                        }
                      }}
                      className="flex cursor-pointer justify-between items-center rounded-lg pb-4 border-b border-[#D9D9D9] px-2 py-2 transition-colors hover:bg-[#FFF8F1]"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#757575]">
                          Shop:{' '}
                          <Link
                            href={`/shop/${item.shop_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#1E1E1E] hover:text-[#FF8D28] hover:underline"
                          >
                            {shopNameById[item.shop_id] || item.shop_id}
                          </Link>
                        </p>
                        <Link
                          href={`/product/${item.product_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[#1E1E1E] hover:text-[#FF8D28] hover:underline"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(item.product_id, -1);
                            }}
                            className="h-7 w-7 rounded-md border border-[#D9D9D9] text-sm font-bold text-[#1E1E1E] hover:border-[#FF8D28]"
                          >
                            -
                          </button>
                          <span className="min-w-8 text-center text-sm text-[#757575]">Qty: {item.quantity}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(item.product_id, 1);
                            }}
                            className="h-7 w-7 rounded-md border border-[#D9D9D9] text-sm font-bold text-[#1E1E1E] hover:border-[#FF8D28]"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product_id);
                            }}
                            className="ml-2 text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <p className="font-bold text-[#1E1E1E]">Rs. {item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Details */}
              <form onSubmit={handleCheckout} className="mt-8 bg-white border-2 border-[#D9D9D9] rounded-lg p-6">
                <h2 className="text-xl font-bold text-[#1E1E1E] mb-4">Delivery Details</h2>

                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                      Delivery Address
                    </label>
                    <input
                      id="delivery-address"
                      type="text"
                      value={deliveryLocation}
                      onFocus={() => {
                        setShowSuggestions(suggestions.length > 0);
                        setActiveSuggestionIndex(suggestions.length > 0 ? 0 : -1);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setShowSuggestions(false), 120);
                      }}
                      onKeyDown={(event) => {
                        if (!showSuggestions || suggestions.length === 0) return;
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setActiveSuggestionIndex((current) =>
                            Math.min(current + 1, suggestions.length - 1)
                          );
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
                        } else if (event.key === 'Enter') {
                          if (activeSuggestionIndex >= 0) {
                            event.preventDefault();
                            handleSuggestionSelect(suggestions[activeSuggestionIndex]);
                          }
                        }
                      }}
                      onChange={(e) => {
                        setDeliveryLocation(e.target.value);
                        setLatitude('');
                        setLongitude('');
                      }}
                      placeholder="Search address (OpenStreetMap) or enter manually"
                      required
                      className="w-full px-4 py-2 border-2 border-[#D9D9D9] rounded-lg text-[#1E1E1E] focus:outline-none focus:border-[#FF8D28]"
                    />
                    {showSuggestions && (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#E5E5E5] bg-white shadow-lg">
                        {suggestionsLoading ? (
                          <p className="px-3 py-2 text-sm text-[#757575]">Searching locations...</p>
                        ) : suggestions.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-[#757575]">No matching locations found.</p>
                        ) : (
                          suggestions.map((suggestion, index) => (
                            <button
                              key={suggestion.place_id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className={`block w-full border-b border-[#F3F3F3] px-3 py-2 text-left text-sm text-[#1E1E1E] hover:bg-[#FFF4E5] ${
                                index === activeSuggestionIndex
                                  ? 'bg-[#FFF4E5]'
                                  : ''
                              }`}
                            >
                              {suggestion.display_name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    <p className="mt-2 flex items-center gap-1 text-xs text-[#757575]">
                      <HiMapPin />
                      Select a suggestion to auto-fill latitude/longitude (Pakistan-only OpenStreetMap search).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="e.g., 33.6844"
                        required
                        className="w-full px-4 py-2 border-2 border-[#D9D9D9] rounded-lg text-[#1E1E1E] focus:outline-none focus:border-[#FF8D28]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="e.g., 73.0479"
                        required
                        className="w-full px-4 py-2 border-2 border-[#D9D9D9] rounded-lg text-[#1E1E1E] focus:outline-none focus:border-[#FF8D28]"
                      />
                    </div>
                  </div>
                </div>

                {/* Order Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 px-6 py-3 bg-[#FF8D28] text-black font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Placing Order...' : 'Place Order'}
                </button>
              </form>
            </div>

            {/* Order Total */}
            <div className="lg:col-span-1">
              <div className="bg-white border-2 border-[#D9D9D9] rounded-lg p-6 sticky top-20">
                <h2 className="text-xl font-bold text-[#1E1E1E] mb-4">Order Total</h2>

                <div className="space-y-3 pb-4 border-b border-[#D9D9D9]">
                  <div className="flex justify-between">
                    <p className="text-[#757575]">Subtotal</p>
                    <p className="font-semibold text-[#1E1E1E]">Rs. {totalAmount}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-[#757575]">Delivery Fee</p>
                    <p className="font-semibold text-[#1E1E1E]">Rs. 0</p>
                  </div>
                </div>

                <div className="flex justify-between mt-4">
                  <p className="font-bold text-[#1E1E1E] text-lg">Total</p>
                  <p className="font-bold text-[#1E1E1E] text-lg">Rs. {totalAmount}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}