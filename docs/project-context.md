# Kids Wear — Project Context

## Business Overview

- **Business Name**: Kids Wear
- **Model**: B2C apparel e-commerce platform operating in Pakistan.
- **Storefronts**: Three distinct customer experiences sharing a single platform:
  1. **Mini Sprouts**: 0–10 Years (Infants, Toddlers, Kids)
  2. **Teen Studio**: 11–16 Years (Teens)
  3. **Aura Studio**: 17+ Years (Young Adults & Beyond)

## Core Commerce Model

- **Shared Core Platform**:
  - One frontend Next.js application handling routing for all storefronts.
  - One Fastify REST API backend (`/api/v1`).
  - One shared PostgreSQL database managed via Prisma.
  - One centralized Admin system.
  - One unified cart, checkout, and order management engine.
- **Inventory Model**: Boolean exact-variant availability (Available / Unavailable; no numeric inventory).
  - Variant definition: exact combination of `Size + Color`.
  - Variant availability is **Boolean** (`isAvailable: true/false`), not numeric stock quantities.
- **Checkout & Customers**:
  - Full support for **Guest Checkout** (no forced registration).
  - Optional customer account creation and authentication.
- **Payment Methods**:
  - Cash on Delivery (COD).
  - Manual Bank Transfer (offline proof-of-payment review by Admin).
  - No online credit card or third-party payment gateway in V1.
- **Shipping**:
  - Flat delivery rate across Pakistan.
  - Manual fulfillment tracking; no courier API integration in V1.
- **Administration**:
  - Single Admin account role in V1.
- **Architecture**:
  - Modular monolith. No microservices, GraphQL, or distributed queue infrastructure.

## Deployment & Hosting Architecture

- **Frontend Platform**: Vercel (Next.js App Router).
- **Backend Platform**: Belmo (Fastify REST API).
- **Database**: PostgreSQL (Supabase).
- **Media Asset Storage / CDN**: Cloudinary.
- **Transactional Email**: Resend.
- **Production Hostnames & Domains**: Pending Client Input. Final production and staging domain names, DNS records, and SSL certificates are not hardcoded and will be configured via environment variables.
