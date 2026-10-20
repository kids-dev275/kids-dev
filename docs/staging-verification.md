# Kids Wear — Staging Verification Checklist & Operational Procedures

This document provides the operational runbook and verification procedures for validating a live deployed Kids Wear staging environment.

> [!IMPORTANT]
> **Live Staging Environment Status: NOT DEPLOYED / NOT VERIFIED**.
> The scenarios below constitute the target operational runbook for when external cloud staging infrastructure is provisioned. Currently, all scenarios are classified as **LIVE STAGING: NOT VERIFIED**.

---

## 1. Automated Staging Smoke Verification

Execute the non-destructive smoke runner:

```bash
STAGING_WEB_URL="https://<authoritative-staging-origin>" \
STAGING_API_URL="https://<authoritative-staging-api>/api/v1" \
pnpm test:staging
```

For destructive/transactional staging checks:

```bash
STAGING_WEB_URL="https://<authoritative-staging-origin>" \
STAGING_API_URL="https://<authoritative-staging-api>/api/v1" \
STAGING_TEST_MODE="true" \
pnpm test:staging
```

### Safety Guard Validations:

- Refuses execution if either `STAGING_WEB_URL` or `STAGING_API_URL` is missing.
- Refuses execution if targeted host matches known production domains or ambiguous configurations.
- Fails closed on all destructive checks (Order creation, Customer registration, Admin state, Reviews, Settings, Media upload) unless `STAGING_TEST_MODE=true` is explicitly provided.

---

## 2. Bank-Transfer Staging Safety Mandates

Before entering or testing bank transfer configuration in staging, strictly follow these safety rules:

- **Do not seed or commit real bank details.**
- **Use test-only Admin-entered bank details in staging if validation permits.**
- **Clearly identify staging bank information as test data.**
- **Do not accept or request real customer transfers in staging.**

---

## 3. Manual Staging Verification Scenarios (LIVE STAGING: NOT VERIFIED)

### Scenario 1: Search Engine Safety & Headers [LIVE STAGING: NOT VERIFIED]

1. Inspect the public staging response headers using curl or browser DevTools:
   ```bash
   curl -I https://<authoritative-staging-origin>/
   ```
2. Verify headers:
   - `x-robots-tag: noindex, nofollow`
   - `x-content-type-options: nosniff`
   - `x-frame-options: DENY`
   - `content-security-policy`: contains `'self'`, `connect-src`, `img-src` with `res.cloudinary.com`
3. Fetch `https://<authoritative-staging-origin>/robots.txt`:
   - Verify `Disallow: /` is emitted for staging crawler blocking.

---

### Scenario 2: Public Storefront Navigation & PDP [LIVE STAGING: NOT VERIFIED]

1. Visit `https://<authoritative-staging-origin>/`.
2. Navigate across all 3 storefronts:
   - `/mini-sprouts`
   - `/teen-studio`
   - `/aura-studio`
3. Open a representative PDP:
   - Verify Main image loads from `res.cloudinary.com`.
   - Verify Color and Size selectors function.
   - Verify unavailable variant combinations display `"This combination is currently unavailable"` and disable the Add to Cart button.
   - Verify available combinations display `"Available"`.
   - Verify quantity selector allows values 1 through 10.
   - Verify Size Guide modal opens and closes.

---

### Scenario 3: Cart & Client-Side Persistence [LIVE STAGING: NOT VERIFIED]

1. Add an available product variant to cart.
2. Refresh the browser page (`F5` / `Cmd+R`).
3. Verify the item remains in cart with correct size, color, quantity, and unit price.
4. Navigate across storefronts and verify cart state remains consistent.

---

### Scenario 4: COD Checkout & Order Creation [LIVE STAGING: NOT VERIFIED]

1. Proceed from Cart to `/checkout`.
2. Fill required customer fields:
   - Full Name: `Test Customer`
   - Phone: `03001234567`
   - Address: `123 Staging Street`
   - City: `Lahore`
   - Province: `Punjab`
3. Select Payment Method: **Cash on Delivery (COD)**.
4. Submit the Order:
   - Verify successful redirect to `/order-success`.
   - Verify assigned order number has sequence format `KW-1001`, `KW-1002`, ...
   - Verify initial order status is `ORDER_RECEIVED`.
   - Verify delivery charge matches configured Admin shipping setting (e.g., PKR 300).

---

### Scenario 5: Bank Transfer Checkout [LIVE STAGING: NOT VERIFIED]

1. Ensure test-only bank details are entered in Admin Settings adhering to the Bank-Transfer Staging Safety Mandates.
2. Add item to cart and proceed to `/checkout`.
3. Select Payment Method: **Manual Bank Transfer**.
4. Submit the Order:
   - Verify initial status is `AWAITING_PAYMENT`.
   - Verify test bank transfer instructions and test coordinates are presented clearly.
   - Verify no private application secrets or internal identifiers are exposed.

---

### Scenario 6: Customer Account Lifecycle [LIVE STAGING: NOT VERIFIED]

1. Navigate to `/account/register`.
2. Register a new test customer account.
3. Verify automatic login and redirection to customer account overview.
4. Verify Customer cookie `kw_customer_session` is set with `HttpOnly; Secure; SameSite=None` (or `Lax`).
5. Verify order history displays orders placed by this customer.
6. Verify customer isolation: Customer cannot access orders belonging to other customers or guest orders.
7. Logout and verify customer session is destroyed.

---

### Scenario 7: Admin Panel Operations [LIVE STAGING: NOT VERIFIED]

1. Navigate to `/admin/login`.
2. Authenticate as the designated Admin (`sk.fabrica@gmail.com`).
3. Verify Admin cookie `kw_admin_session` is set with `HttpOnly; Secure`.
4. Dashboard:
   - Verify dashboard metrics: Total Products, Total Orders, Active Orders, Unavailable Variants, Recent Orders.
5. Product Management:
   - Create Draft Product with canonicalized SKU.
   - Configure colors, sizes, and exact variants with boolean availability.
   - Upload media via signed Cloudinary flow.
   - Set Main image and optional Hover image.
   - Publish Product and verify visibility on public storefront.
   - Deactivate Product and verify 404 on public route.
6. Order Management:
   - Locate test order created during staging smoke.
   - View order detail and historical snapshots.
   - Perform valid status transition (e.g., `ORDER_RECEIVED` → `CONFIRMED` → `IN_PRODUCTION`).
7. Review Moderation:
   - View pending reviews.
   - Approve review and verify publication on PDP.
8. Commerce Settings:
   - Update Flat Delivery Charge.
   - Verify updated charge reflects on public checkout without altering historical order snapshots.
9. Logout and verify admin session revocation.

---

## 4. Session & Domain Isolation Verification [LIVE STAGING: NOT VERIFIED]

| Test Case                         | Expected Behavior                                                                      |
| :-------------------------------- | :------------------------------------------------------------------------------------- |
| Admin cookie on Customer endpoint | Fastify returns `401 Unauthorized`.                                                    |
| Customer cookie on Admin endpoint | Fastify returns `401 Unauthorized`.                                                    |
| Customer logout                   | Customer session revoked; Admin session (if open) remains valid.                       |
| Admin logout                      | Admin session revoked; Customer session (if open) remains valid.                       |
| CSRF Token Substitution           | Mutation using Customer CSRF token against Admin route fails `403 Forbidden`.          |
| Rate Limit Bypass                 | Ordinary staging requests must **not** bypass rate limiting. No E2E bypass in staging. |
