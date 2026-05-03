export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  location_id?: string;
}

export interface Product {
  product_id: string;
  shop_id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  /** 0–100; optional on demo catalog (treated as 0). */
  discount_percent?: number;
  /** Final unit price after discount; optional on demo (computed client-side). */
  effective_price?: number;
  is_active: boolean;
  /** In-stock units from API; omit on demo catalog (treated as available). */
  stock_quantity?: number;
  /** Optional: returned by backend analytics endpoints */
  total_sold?: number;
  units_sold?: number;
}

export interface Shop {
  shop_id: string;
  name: string;
  owner_id: string;
  location: Location;
  is_active: boolean;
}

export interface OrderItem {
  order_item_id: string;
  product_id: string;
  shop_id: string;
  quantity: number;
  unit_price: number;
}

export interface OrderSummary {
  order_id: string;
  customer_id: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  is_multi_shop: boolean;
  delivery_location: Location;
  items: OrderItem[];
  pickup_legs?: PickupLeg[];
  created_at?: string | null;
}

export interface PickupLeg {
  leg_id: string;
  shop_id: string;
  sequence: number;
  picked: boolean;
  shop_name?: string;
  shop_address?: string;
}

export interface Delivery {
  delivery_id: string;
  order_id: string;
  rider_id?: string;
  status: string;
  notes?: string;
  created_at?: string | null;
  delivered_at?: string | null;
  pickup_locations?: Location[];
  dropoff_location?: Location;
  pickup_legs?: PickupLeg[];
}

export interface BatchTrip {
  batch_id: string;
  rider_id: string;
  status: string;
  order_ids: string[];
  stops?: BatchStop[];
}

export interface BatchStop {
  sequence: number;
  kind: string;
  order_id: string;
  shop_id?: string;
  location: Location;
}

export interface PickupLeg {
  id: string;
  order_id: string;
  shop_id: string;
  sequence_number: number;
  status: string;
  items_count: number;
}
