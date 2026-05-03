# EasySamaan Bug Log

This file tracks known bugs for the frontend.

## Open

1. Global lint/type issues exist in untouched files
   - Several pages still contain `any` usage and other lint errors from older code.
   - Impact: Full-repo lint fails, even when new features are clean.
   - Suggested fix: Clean `any` usage and unescaped entities across legacy pages.

2. Cart item key collision risk in checkout
   - Checkout currently keys cart lines by `product_id`.
   - If the same product appears from different shops (edge case), quantity controls/removal could act on unintended items.
   - Suggested fix: Use composite key (`product_id + shop_id`).

3. Header smart search fetch strategy can be optimized
   - Header search currently fetches product list and filters client-side for suggestions.
   - Impact: Can become inefficient for large catalogs.
   - Suggested fix: Add backend search endpoint with query/pagination and debounce on client.

4. Role access policy not fully strict for checkout
   - Status: Partially addressed (frontend).
   - Notes: `shop_owner` and `rider` no longer see Shop/Checkout/cart in the header, and `/shop` + `/checkout` redirect for those roles. Customers and guests retain full shopping UI.

## Resolved

1. Shop filters: grid showed large gaps / “missing” products after clearing category filters
   - Status: Fixed.
   - Cause: The product grid used `Stagger` with `whileInView` + `once: true`. New `StaggerItem` nodes (products that re-entered the list after a filter reset) mounted while the parent had already finished its one-time `"show"` transition, so those items could stay on the `hidden` variant (`opacity: 0`) while still occupying grid cells—visible cards looked scattered with empty space between them.
   - Fix: Set `initial={false}` on `StaggerItem` in `app/components/MotionPrimitives.tsx` so children follow the parent’s current variant when they mount (see Motion / Framer stagger + dynamic lists).

2. Quick Add button did not add products to cart
   - Status: Fixed.
   - Notes: Now writes to `localStorage` cart and updates header badge.

3. Cart did not support remove/update quantity
   - Status: Fixed.
   - Notes: Added +/- controls and remove action in checkout.

4. Manual lat/lng entry requirement was inconvenient
   - Status: Improved.
   - Notes: Google Places autocomplete now auto-fills latitude/longitude when API key is configured.

5. Address autocomplete initially searched globally (unnecessary resource usage)
   - Status: Improved.
   - Notes: OpenStreetMap Nominatim autocomplete is now restricted to Pakistan (`countrycodes=pk`) to reduce unnecessary query scope and improve relevance.

6. Logout did not clear shopping cart
   - Status: Fixed.
   - Notes: `logout()` now clears `localStorage` cart and dispatches `cart:update`.

7. Shop owner: applying product discount showed “Failed to fetch”
   - Status: Addressed.
   - Cause: Often a **browser network / CORS** issue: the tab may be on `http://127.0.0.1:3000` while `ALLOWED_ORIGINS` only listed `http://localhost:3000` (different origins). Some environments surface that as a failed `fetch` on `PUT`/`PATCH` after preflight. Empty Supabase update rows could also break the handler.
   - Fix: Development CORS now allows any port on `localhost` and `127.0.0.1` via `allow_origin_regex` in `app/main.py`; default `allowed_origins` includes both hostnames; dashboard uses `PATCH /shop-owner/products/{id}` for partial discount updates; `api-client` maps generic fetch failures to a clearer message; product repo falls back to `get` if update returns no row.

## Workflow

- Add new issues to **Open** with:
  - short title
  - impact
  - suggested fix
- Move to **Resolved** only after verification.
