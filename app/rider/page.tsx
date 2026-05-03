'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiMapPin, HiTruck } from 'react-icons/hi2';

import { useAuth } from '../lib/auth-context';
import { apiClient } from '../lib/api-client';
import { Delivery } from '../lib/types';
import { areaBatchKey, haversineDistanceKm, proximityBand, proximityCardClass, proximityLabel, ProximityBand } from '../lib/geo';
import { readRiderSimulatedLocation, RiderSimulatedLocation, saveRiderSimulatedLocation } from '../lib/customer-orders-local';

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface UnifiedDelivery {
  deliveryId: string;
  orderId: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  band: ProximityBand | 'unknown';
  batchKey: string;
  status: string;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function toUnifiedDelivery(d: Delivery, riderLoc: RiderSimulatedLocation | null): UnifiedDelivery {
  const lat = d.dropoff_location?.latitude ?? null;
  const lon = d.dropoff_location?.longitude ?? null;
  const address = d.dropoff_location?.address ?? 'Unknown address';
  const hasCoords = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
  const hasRiderCoords = riderLoc != null;
  const distanceKm = hasCoords && hasRiderCoords ? haversineDistanceKm(riderLoc.latitude, riderLoc.longitude, lat, lon) : null;
  const band = distanceKm == null ? 'unknown' : proximityBand(distanceKm);
  const normalizedAddress = normalizeAddress(address);
  const batchKey = normalizedAddress
    ? `addr:${normalizedAddress}`
    : hasCoords
      ? `geo:${areaBatchKey(lat, lon)}`
      : `order:${d.order_id}`;

  return {
    deliveryId: d.delivery_id,
    orderId: d.order_id,
    address,
    latitude: lat,
    longitude: lon,
    distanceKm,
    band,
    batchKey,
    status: d.status,
  };
}

function cardClass(delivery: UnifiedDelivery): string {
  if (delivery.band === 'unknown') return 'border-neutral-300 bg-neutral-50';
  return proximityCardClass[delivery.band];
}

function bandLabel(delivery: UnifiedDelivery): string {
  if (delivery.band === 'unknown') return 'Set location for distance color';
  return `${proximityLabel[delivery.band]}${delivery.distanceKm != null ? ` · ${delivery.distanceKm.toFixed(1)} km` : ''}`;
}

async function markAllPickupLegs(deliveryId: string, token: string) {
  const d = (await apiClient.get(`/rider/deliveries/${deliveryId}`, token)) as Delivery;
  const legs = d.pickup_legs ?? [];
  for (const leg of legs) {
    const id = (leg as { leg_id?: string; id?: string }).leg_id ?? (leg as { id?: string }).id;
    if (!id) continue;
    await apiClient.post(`/rider/pickup-legs/${id}/mark-picked`, {}, token);
  }
}

async function advanceToDelivered(deliveryId: string, token: string) {
  const patch = (status: string) => apiClient.patch(`/rider/deliveries/${deliveryId}/status`, { status }, token);
  for (let i = 0; i < 10; i++) {
    const current = (await apiClient.get(`/rider/deliveries/${deliveryId}`, token)) as Delivery;
    const status = (current.status ?? '').toLowerCase();
    if (status === 'delivered') return;
    if (status === 'cancelled') throw new Error('Delivery already cancelled.');
    if (status === 'assigned') {
      await patch('picking_up');
      continue;
    }
    if (status === 'picking_up') {
      try {
        await patch('picked_up');
      } catch {
        await markAllPickupLegs(deliveryId, token);
        await patch('picked_up');
      }
      continue;
    }
    if (status === 'picked_up') {
      await patch('in_transit');
      continue;
    }
    if (status === 'in_transit') {
      await patch('delivered');
      continue;
    }
    throw new Error(`Cannot continue from status ${status}`);
  }
  throw new Error('Delivery could not be completed in time.');
}

export default function RiderPage() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'open' | 'mine'>('open');
  const [apiAvailable, setApiAvailable] = useState<Delivery[]>([]);
  const [apiMine, setApiMine] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [riderLoc, setRiderLoc] = useState<RiderSimulatedLocation | null>(null);
  const [showLocPanel, setShowLocPanel] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locSuggestions, setLocSuggestions] = useState<NominatimSuggestion[]>([]);
  const fetchSeq = useRef(0);

  useEffect(() => setRiderLoc(readRiderSimulatedLocation()), []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'rider') router.push('/');
  }, [isAuthenticated, user, router]);

  const loadDeliveries = useCallback(async () => {
    if (!token) return;
    const requestId = ++fetchSeq.current;
    setRefreshing(true);
    setError('');
    try {
      const available = (await apiClient.get('/rider/deliveries/available', token)) as Delivery[];
      if (requestId === fetchSeq.current) setApiAvailable(Array.isArray(available) ? available : []);

      const minePromise = apiClient.get('/rider/deliveries?active_only=true', token) as Promise<Delivery[]>;
      if (activeTab === 'mine') {
        const mine = await minePromise;
        if (requestId === fetchSeq.current) setApiMine(Array.isArray(mine) ? mine : []);
      } else {
        void minePromise.then((mine) => {
          if (requestId === fetchSeq.current) setApiMine(Array.isArray(mine) ? mine : []);
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load rider deliveries.';
      setError(msg);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'rider' && token) void loadDeliveries();
  }, [isAuthenticated, user, token, loadDeliveries]);

  useEffect(() => {
    if (locQuery.trim().length < 3) {
      setLocSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLocLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=pk&q=${encodeURIComponent(locQuery)}`,
          { signal: controller.signal, headers: { Accept: 'application/json', 'Accept-Language': 'en-PK,en;q=0.9' } }
        );
        if (!res.ok) throw new Error('Location search failed');
        setLocSuggestions((await res.json()) as NominatimSuggestion[]);
      } catch {
        setLocSuggestions([]);
      } finally {
        setLocLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [locQuery]);

  const myActiveOrderIds = useMemo(
    () => new Set(apiMine.filter((d) => !['delivered', 'completed', 'cancelled'].includes((d.status ?? '').toLowerCase())).map((d) => d.order_id)),
    [apiMine]
  );

  const openOrders = useMemo(
    () => apiAvailable.filter((d) => !myActiveOrderIds.has(d.order_id)).map((d) => toUnifiedDelivery(d, riderLoc)),
    [apiAvailable, myActiveOrderIds, riderLoc]
  );

  const myOrders = useMemo(
    () => apiMine.filter((d) => !['delivered', 'completed', 'cancelled'].includes((d.status ?? '').toLowerCase())).map((d) => toUnifiedDelivery(d, riderLoc)),
    [apiMine, riderLoc]
  );

  const groupDeliveries = useCallback((rows: UnifiedDelivery[]) => {
    const grouped = new Map<string, UnifiedDelivery[]>();
    for (const row of rows) {
      const list = grouped.get(row.batchKey) ?? [];
      list.push(row);
      grouped.set(row.batchKey, list);
    }
    return [...grouped.entries()]
      .map(([batchKey, orders]) => ({ batchKey, orders: orders.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)) }))
      .sort((a, b) => (a.orders[0]?.distanceKm ?? 1e9) - (b.orders[0]?.distanceKm ?? 1e9));
  }, []);

  const groupedOpen = useMemo(() => groupDeliveries(openOrders), [openOrders, groupDeliveries]);
  const groupedMine = useMemo(() => groupDeliveries(myOrders), [myOrders, groupDeliveries]);

  const selectLocation = (s: NominatimSuggestion) => {
    setRiderLoc(saveRiderSimulatedLocation({ address: s.display_name, latitude: Number(s.lat), longitude: Number(s.lon) }));
    setLocQuery(s.display_name);
    setLocSuggestions([]);
    setShowLocPanel(false);
  };

  const acceptBatch = async (orders: UnifiedDelivery[]) => {
    if (!token) return;
    setActionBusy(true);
    const failures: string[] = [];
    for (const order of orders) {
      try {
        await apiClient.post(`/rider/deliveries/${order.deliveryId}/accept`, {}, token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Accept failed';
        failures.push(`${order.orderId}: ${msg}`);
      }
    }
    await loadDeliveries();
    setActionBusy(false);
    if (failures.length) alert(`Some orders could not be accepted:\n${failures.join('\n')}`);
    else setActiveTab('mine');
  };

  const deliverBatch = async (orders: UnifiedDelivery[]) => {
    if (!token) return;
    setActionBusy(true);
    const failures: string[] = [];
    for (const order of orders) {
      try {
        await advanceToDelivered(order.deliveryId, token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Delivery failed';
        failures.push(`${order.orderId}: ${msg}`);
      }
    }
    await loadDeliveries();
    setActionBusy(false);
    if (failures.length) alert(`Some deliveries could not be completed:\n${failures.join('\n')}`);
    else {
      setSuccessMessage(orders.length > 1 ? `Marked ${orders.length} deliveries as done ✓` : 'Delivery marked as done ✓');
      window.setTimeout(() => setSuccessMessage(''), 2600);
    }
  };

  if (!isAuthenticated || user?.role !== 'rider') return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <main
        className="mx-auto max-w-6xl px-4 py-8 md:px-8"
        style={{ backgroundImage: "linear-gradient(to bottom, rgba(10,10,10,0.85), rgba(10,10,10,0.95)), url('/rider-dashboard-bg.svg')", backgroundSize: 'cover' }}
      >
        <section className="rounded-3xl border border-white/20 bg-black/35 p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-200">
                <HiTruck className="text-base" />
                Rider Dashboard
              </div>
              <h1 className="text-3xl font-black tracking-tight">Delivery Command Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">Color-coded by distance, smart batching for same drop-offs, and one-tap accept/deliver workflows.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowLocPanel((v) => !v)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400"
            >
              {showLocPanel ? 'Close Location' : riderLoc ? 'Change Location' : 'Set Location'}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
            {riderLoc ? `${riderLoc.address} · ${riderLoc.latitude.toFixed(4)}, ${riderLoc.longitude.toFixed(4)}` : 'Location not set yet. Distance colors will stay neutral until you set location.'}
          </div>

          {showLocPanel && (
            <div className="mt-4 rounded-xl border border-white/15 bg-black/40 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold"><HiMapPin /> Search location (Pakistan)</label>
              <input
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                placeholder="e.g. Johar Town Lahore"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-orange-400 focus:outline-none"
              />
              {locLoading && <p className="mt-2 text-xs text-white/70">Searching...</p>}
              {locSuggestions.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/15 bg-black/65">
                  {locSuggestions.map((s) => (
                    <li key={s.place_id}>
                      <button type="button" onClick={() => selectLocation(s)} className="w-full border-b border-white/10 px-3 py-2 text-left text-sm hover:bg-white/10 last:border-b-0">
                        {s.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/20 bg-black/30 p-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/15 pb-3">
            <button onClick={() => setActiveTab('open')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'open' ? 'bg-orange-500 text-black' : 'bg-white/10 text-white'}`}>
              Open Orders ({openOrders.length})
            </button>
            <button onClick={() => setActiveTab('mine')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'mine' ? 'bg-orange-500 text-black' : 'bg-white/10 text-white'}`}>
              My Deliveries ({myOrders.length})
            </button>
            <button onClick={() => void loadDeliveries()} disabled={refreshing || actionBusy} className="ml-auto rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {error && <div className="mt-4 rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {successMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300/45 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black">✓</span>
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}
          {loading ? (
            <p className="py-10 text-center text-white/70">Loading deliveries...</p>
          ) : activeTab === 'open' ? (
            groupedOpen.length === 0 ? <p className="py-10 text-center text-white/70">No open orders available.</p> : (
              <div className="mt-4 space-y-5">
                {groupedOpen.map(({ batchKey, orders }) => {
                  const isBatch = orders.length > 1;
                  return (
                    <section key={batchKey} className={`rounded-2xl p-4 ${isBatch ? 'border border-orange-300/40 bg-orange-500/10' : 'border border-white/15 bg-white/5'}`}>
                      {isBatch && <p className="mb-3 text-sm font-bold text-orange-200">Batch of {orders.length} deliveries from same drop-off</p>}
                      <div className="space-y-3">
                        {orders.map((o) => (
                          <article key={o.deliveryId} className={`rounded-xl border-2 p-3 ${cardClass(o)}`}>
                            <p className="text-xs font-semibold uppercase text-black/70">{o.orderId}</p>
                            <p className="mt-1 text-sm font-semibold text-black">{o.address}</p>
                            <p className="mt-1 text-xs text-black/70">{bandLabel(o)}</p>
                          </article>
                        ))}
                      </div>
                      <button disabled={actionBusy || refreshing} onClick={() => void acceptBatch(orders)} className="mt-3 w-full rounded-lg bg-orange-500 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50">
                        {isBatch ? `Accept all ${orders.length}` : 'Accept order'}
                      </button>
                    </section>
                  );
                })}
              </div>
            )
          ) : groupedMine.length === 0 ? (
            <p className="py-10 text-center text-white/70">No active deliveries yet.</p>
          ) : (
            <div className="mt-4 space-y-5">
              {groupedMine.map(({ batchKey, orders }) => {
                const isBatch = orders.length > 1;
                return (
                  <section key={batchKey} className={`rounded-2xl p-4 ${isBatch ? 'border border-emerald-300/35 bg-emerald-500/10' : 'border border-white/15 bg-white/5'}`}>
                    {isBatch && <p className="mb-3 text-sm font-bold text-emerald-200">Batched active deliveries ({orders.length})</p>}
                    <div className="space-y-3">
                      {orders.map((o) => (
                        <article key={o.deliveryId} className={`rounded-xl border-2 p-3 ${cardClass(o)}`}>
                          <p className="text-xs font-semibold uppercase text-black/70">{o.orderId}</p>
                          <p className="mt-1 text-sm font-semibold text-black">{o.address}</p>
                          <p className="mt-1 text-xs text-black/70">{bandLabel(o)}</p>
                        </article>
                      ))}
                    </div>
                    <button disabled={actionBusy || refreshing} onClick={() => void deliverBatch(orders)} className="mt-3 w-full rounded-lg border border-emerald-300/50 bg-emerald-400/20 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-400/30 disabled:opacity-50">
                      {isBatch ? `Mark all ${orders.length} delivered` : 'Mark delivered'}
                    </button>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
