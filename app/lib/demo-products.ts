import type { Product } from './types';

/**
 * Shown when GET /products fails and the user has no token (e.g. backend requires auth for catalog).
 * Keeps browsing/cart flows working for guests without a signed-in session.
 */
export const DEMO_PRODUCTS: Product[] = [
  {
    product_id: 'demo-basmati-5kg',
    shop_id: 'demo-shop-gulberg',
    name: 'Basmati Rice 5kg',
    description: 'Aged long-grain basmati — demo product for guest browsing.',
    category: 'Groceries',
    price: 1299,
    is_active: true,
    stock_quantity: 80,
  },
  {
    product_id: 'demo-sunflower-oil',
    shop_id: 'demo-shop-gulberg',
    name: 'Sunflower Cooking Oil 3L',
    description: 'Fortified cooking oil.',
    category: 'Groceries',
    price: 1890,
    is_active: true,
    stock_quantity: 40,
  },
  {
    product_id: 'demo-mango-juice',
    shop_id: 'demo-shop-dha',
    name: 'Mango Juice 1L (pack of 6)',
    description: 'No added preservatives — demo listing.',
    category: 'Groceries',
    price: 720,
    is_active: true,
    stock_quantity: 0,
  },
  {
    product_id: 'demo-cotton-tee',
    shop_id: 'demo-shop-dha',
    name: 'Cotton T-Shirt',
    description: 'Unisex, multiple colors — demo.',
    category: 'Fashion',
    price: 1499,
    is_active: true,
    stock_quantity: 25,
  },
  {
    product_id: 'demo-wireless-earbuds',
    shop_id: 'demo-shop-saddar',
    name: 'Wireless Earbuds',
    description: 'Bluetooth 5.3, charging case — demo.',
    category: 'Electronics',
    price: 4499,
    is_active: true,
    stock_quantity: 12,
  },
  {
    product_id: 'demo-kettle',
    shop_id: 'demo-shop-saddar',
    name: 'Electric Kettle 1.7L',
    description: 'Auto shut-off, stainless steel — demo.',
    category: 'Home',
    price: 3299,
    is_active: true,
    stock_quantity: 30,
  },
];

export function getDemoProductById(productId: string): Product | undefined {
  return DEMO_PRODUCTS.find((p) => p.product_id === productId);
}
