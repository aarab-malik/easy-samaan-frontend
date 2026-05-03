import type { Product } from './types';

/** Sale price after discount (API sends `effective_price` when available). */
export function getDisplayPrice(product: Product): number {
  if (typeof product.effective_price === 'number' && !Number.isNaN(product.effective_price)) {
    return product.effective_price;
  }
  const base = product.price;
  const d = product.discount_percent ?? 0;
  const clamped = Math.min(100, Math.max(0, d));
  return Math.round(base * (1 - clamped / 100) * 100) / 100;
}

export function hasActiveDiscount(product: Product): boolean {
  const d = product.discount_percent ?? 0;
  return d > 0;
}
