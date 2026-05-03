const ORDERS_KEY = 'easysamaan_placed_orders_v1';
const RIDER_LOCATION_KEY = 'easysamaan_rider_sim_location_v1';

export type OrderFulfillmentStatus = 'placed' | 'in_delivery' | 'delivered';

export interface PlacedOrderLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface PlacedOrderRecord {
  order_id: string;
  delivery_location: { latitude: number; longitude: number; address: string };
  items: PlacedOrderLine[];
  total_amount: number;
  created_at: string;
  fulfillment_status: OrderFulfillmentStatus;
  accepted_by_rider_id?: string;
}

export interface RiderSimulatedLocation {
  address: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export function readPlacedOrders(): PlacedOrderRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlacedOrderRecord[]) : [];
  } catch {
    return [];
  }
}

function writePlacedOrders(orders: PlacedOrderRecord[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function appendPlacedOrder(
  order: Omit<PlacedOrderRecord, 'fulfillment_status'> & { fulfillment_status?: OrderFulfillmentStatus }
) {
  const all = readPlacedOrders();
  all.push({
    ...order,
    fulfillment_status: order.fulfillment_status ?? 'placed',
  });
  writePlacedOrders(all);
}

export function updatePlacedOrder(orderId: string, patch: Partial<PlacedOrderRecord>): boolean {
  const all = readPlacedOrders();
  const i = all.findIndex((o) => o.order_id === orderId);
  if (i === -1) return false;
  all[i] = { ...all[i], ...patch };
  writePlacedOrders(all);
  return true;
}

export function readRiderSimulatedLocation(): RiderSimulatedLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RIDER_LOCATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RiderSimulatedLocation;
  } catch {
    return null;
  }
}

export function saveRiderSimulatedLocation(loc: Omit<RiderSimulatedLocation, 'updated_at'>) {
  const payload: RiderSimulatedLocation = {
    ...loc,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(RIDER_LOCATION_KEY, JSON.stringify(payload));
  return payload;
}

export function clearRiderSimulatedLocation() {
  localStorage.removeItem(RIDER_LOCATION_KEY);
}
