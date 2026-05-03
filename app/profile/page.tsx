'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { apiClient } from '../lib/api-client';
import type { Delivery, OrderSummary, Shop } from '../lib/types';
import SimpleLineChart, { type LineChartPoint } from '../components/SimpleLineChart';

const CHART_DAYS = 14;

function dayKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildSeries(keys: string[], counts: Map<string, number>): LineChartPoint[] {
  return keys.map((k) => ({ label: k, value: counts.get(k) || 0 }));
}

export default function ProfilePage() {
  const router = useRouter();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [me, setMe] = useState<{
    user_id: string;
    email: string;
    full_name?: string | null;
    phone?: string | null;
    role: string;
  } | null>(null);
  const [statTotal, setStatTotal] = useState(0);
  const [chartPoints, setChartPoints] = useState<LineChartPoint[]>([]);
  const [chartTitle, setChartTitle] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) {
      router.push('/login');
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadError('');
      try {
        const profile = (await apiClient.get('/auth/me', token)) as {
          user_id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role: string;
        };
        if (cancelled) return;
        setMe(profile);

        const keys = dayKeys(CHART_DAYS);
        const counts = new Map<string, number>();
        keys.forEach((k) => counts.set(k, 0));

        if (profile.role === 'customer') {
          if (cancelled) return;
          setChartTitle('Orders placed (last 14 days)');
          const orders = (await apiClient.get('/customer/orders', token)) as OrderSummary[];
          if (cancelled) return;
          setStatTotal(orders.length);
          for (const o of orders) {
            const t = o.created_at;
            if (!t) continue;
            const day = String(t).slice(0, 10);
            if (counts.has(day)) counts.set(day, (counts.get(day) || 0) + 1);
          }
          setChartPoints(buildSeries(keys, counts));
        } else if (profile.role === 'shop_owner') {
          if (cancelled) return;
          setChartTitle('Orders with your products (last 14 days)');
          const shops = (await apiClient.get('/shop-owner/shops', token)) as Shop[];
          const seen = new Set<string>();
          const allOrders: OrderSummary[] = [];
          for (const s of shops) {
            const batch = (await apiClient.get(`/shop-owner/shops/${s.shop_id}/orders`, token)) as OrderSummary[];
            for (const o of batch) {
              if (!seen.has(o.order_id)) {
                seen.add(o.order_id);
                allOrders.push(o);
              }
            }
          }
          if (cancelled) return;
          setStatTotal(allOrders.length);
          for (const o of allOrders) {
            const t = o.created_at;
            if (!t) continue;
            const day = String(t).slice(0, 10);
            if (counts.has(day)) counts.set(day, (counts.get(day) || 0) + 1);
          }
          setChartPoints(buildSeries(keys, counts));
        } else if (profile.role === 'rider') {
          if (cancelled) return;
          setChartTitle('Deliveries completed (last 14 days)');
          const deliveries = (await apiClient.get('/rider/deliveries', token)) as Delivery[];
          const done = deliveries.filter((d) => d.status === 'delivered');
          if (cancelled) return;
          setStatTotal(done.length);
          for (const d of done) {
            const t = d.delivered_at || d.created_at;
            if (!t) continue;
            const day = String(t).slice(0, 10);
            if (counts.has(day)) counts.set(day, (counts.get(day) || 0) + 1);
          }
          setChartPoints(buildSeries(keys, counts));
        } else {
          if (cancelled) return;
          setStatTotal(0);
          setChartPoints(buildSeries(keys, counts));
          setChartTitle('Activity (last 14 days)');
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoadError('Could not load profile stats.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, token, router]);

  const statLabel = useMemo(() => {
    if (!me) return '';
    if (me.role === 'customer') return 'Orders placed';
    if (me.role === 'shop_owner') return 'Orders sold (your shops)';
    if (me.role === 'rider') return 'Deliveries completed';
    return 'Total';
  }, [me]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-black/60">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold text-black">Profile</h1>
        <p className="mb-8 text-sm text-black/65">Your account details and recent activity.</p>

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
        )}

        <div className="mb-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-black">Details</h2>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2">
              <dt className="text-black/60">Name</dt>
              <dd className="font-medium text-black">{me?.full_name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2">
              <dt className="text-black/60">Email</dt>
              <dd className="break-all font-medium text-black">{me?.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2">
              <dt className="text-black/60">Phone</dt>
              <dd className="font-medium text-black">{me?.phone || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 pb-1">
              <dt className="text-black/60">Role</dt>
              <dd className="font-medium capitalize text-black">{me?.role?.replace('_', ' ')}</dd>
            </div>
          </dl>
        </div>

        <div className="mb-6 rounded-2xl border border-neutral-200 bg-[#fff9f2] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/55">{statLabel}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-black">{statTotal}</p>
          <p className="mt-1 text-xs text-black/55">All time (from your account data)</p>
        </div>

        <SimpleLineChart points={chartPoints} title={chartTitle} />
      </main>
    </div>
  );
}
