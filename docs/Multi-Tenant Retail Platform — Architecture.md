# Multi-Tenant Retail Platform — Architecture

Oct 17, 2026 · @Thudish

A single codebase that powers independent online stores — pharmacy, hardware, grocery and more — each running as its own tenant with shared infrastructure and near-zero hosting cost.

## Overview

The platform is one Next.js application serving many independent retail businesses — a pharmacy, a hardware shop, a grocery store — each as a separate tenant. A customer visits a tenant's own storefront (its own subdomain or custom domain), browses that store's products, and places an order. Behind the scenes every tenant shares the same code, the same database schema and the same deployment, so adding a new store type or a new store owner never means writing new code.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend + backend | Next.js (React) | One framework for pages and API routes; free to self-host, huge ecosystem, Claude generates it well |
| Styling + UI | Tailwind CSS + shadcn/ui | Fast to build with, consistent theming per tenant, mobile-first by default — most customers are expected to shop from a phone |
| Database, auth, storage | Supabase | Managed Postgres with a generous free tier, built-in authentication, row-level security for tenant isolation, and file storage for product images |
| Hosting | Vercel | Free tier for Next.js apps, automatic deployments from Git, free SSL and a `*.vercel.app` subdomain |
| Payments (later) | Razorpay or Stripe | Pay-as-you-go, no fixed cost until orders flow |

This combination keeps hosting at $0 while prototyping and through early traffic — you only start paying once a tenant's usage outgrows the free tiers, which is a good problem to have.

## Multi-tenancy model

Every row of business data carries a `tenant_id`. One Postgres database, one set of tables, and Supabase row-level security policies ensure a pharmacy's orders are never visible to a hardware shop's queries, even though they share the same schema.

Each tenant has a settings record controlling what makes it feel like a distinct store without touching code: display name and logo, color theme, store category (pharmacy, hardware, grocery, or general retail), currency, and which optional features are switched on — for example a pharmacy might require a prescription upload field on certain products, while a grocery store would not.

A new store owner signs up, picks a subdomain like `greenvalleypharmacy.yourapp.com`, chooses a category template that pre-fills sensible categories and fields, and is trading within minutes — no redeployment, no new code.

Each store instance carries its own tenant config ID, set once at the application/configuration level (an environment variable or a config record tied to the subdomain). Every backend request — API route, database query, storage call — must send that config ID, rather than inferring it from the logged-in user alone. The backend uses it to scope every query, and Supabase row-level security double-checks it against the row's `tenant_id`, so a mismatch is rejected at the database layer even if a bug let a wrong ID slip through at the application layer.

## Data model

Core tables, every one scoped by `tenant_id` except `tenants` and `users` themselves:

| Table | Key columns | Purpose |
| --- | --- | --- |
| tenants | id, name, subdomain, category, theme, currency | One row per store |
| users | id, email, role, tenant\_id (nullable) | Shoppers are global; store staff belong to one tenant |
| categories | id, tenant\_id, name, parent\_id | Product categories, nestable |
| products | id, tenant\_id, name, price, stock\_qty, category\_id, image\_url | What a tenant sells |
| orders | id, tenant\_id, user\_id, status, total, created\_at | A customer's order |
| order\_items | id, order\_id, product\_id, quantity, unit\_price | Line items within an order |
| inventory\_log | id, product\_id, change\_qty, reason, created\_at | Stock movement history |

This shape is deliberately generic: a pharmacy's "product" is a medicine, a grocery's is a vegetable, a hardware shop's is a tool — the schema doesn't care, so one data model serves every store category.

Product images are not stored in the database itself. A store owner or admin uploads an image through the dashboard, it's saved into a Supabase Storage bucket (for example `product-images`, scoped per tenant), and only the resulting file URL is saved in the product row's `image_url` column. Supabase's free tier includes 1 GB of storage; production use at scale moves to a paid plan (from about $25/month) for more storage and daily backups.

## Architecture

&#91;embedded content: architecture · 3 storefronts, 1 app, 1 database\]

Each storefront is the same Next.js deployment, reading the tenant from its subdomain; all data and auth flow through one shared Supabase project.

## Core features

Homepage:

- Hero banner with store branding, introducing the tenant's business
- About us and Contact us sections (or pages), editable per tenant
- Category navigation: customer picks a category and the product grid filters to that category
- Featured or best-selling products section

Product browsing and cart:

- Product grid filtered by category, with search and further filters
- Each product card shows name, image, price, and stock availability (in stock, low stock, or out of stock)
- Out-of-stock products are shown but disabled for "add to cart"
- Product detail page with full description, price, and stock count
- Add to cart from the grid or the detail page; cart shows running total
- Cart and checkout, with payment on delivery or online payment
- Order history and order status tracking
- Account and address management

Store-owner-facing (a dashboard per tenant):

- Edit homepage content: banner, about us, contact details
- Add, edit, and remove products and categories; bulk upload via CSV
- Manage stock levels, with low-stock alerts
- View and update incoming orders (received, packed, shipped, delivered)
- Basic sales reports
- Store settings: logo, theme color, category-specific fields

## Authentication and roles

Supabase Auth handles sign-up and login for everyone, with three roles stored on each user:

- Customer — can browse and order from any tenant; not tied to a single store
- Store owner / staff — tied to one `tenant_id`, can manage that store's products and orders only
- Super admin — platform owner, can create new tenants, suspend a store, and see cross-tenant metrics

Row-level security policies in Postgres enforce these boundaries at the database level, not just in application code, so even a bug in the frontend can't leak one tenant's data to another.

## Admin

A platform-wide admin page, separate from the per-tenant store-owner dashboard, reachable only by the super admin role.

- Secure login, scoped to the super admin role
- View and manage all tenants: create, suspend, or edit store settings across the platform
- Search and edit any product's details directly, across any tenant, for support or moderation
- Cross-tenant visibility into orders and basic usage metrics
- Edit any tenant's homepage content directly, including About us and Contact us details, the same fields the store owner can edit
- Manage user accounts and roles (promote staff, deactivate accounts)

## Deployment plan

1. Create a free Supabase project; define the schema above and enable row-level security per table.
   1. Supabase free tier covers 500 MB database storage and 1 GB file storage, enough for early testing.
2. Push the Next.js code to a GitHub repository.
3. Connect that repository to Vercel; every push to the main branch auto-deploys.
4. Use Vercel's free `*.vercel.app` subdomain to start; a custom domain can be added later for a few dollars a year once a store wants its own domain name.
5. Set environment variables (Supabase URL and keys) in Vercel's dashboard, never committed to the repo.

This whole pipeline costs nothing until traffic or storage outgrows the free tiers.

## Reports

Minimal set to start with, per tenant for store owners and platform-wide for the super admin:

- Sales summary — total revenue and order count, filterable by date range
- Low-stock / out-of-stock alerts — which products need restocking
- Order status breakdown — counts of received, packed, shipped, delivered

More detailed reports (best-sellers, customer trends, cross-tenant comparisons) can be added later once the basics are in use.

## Future feature ideas

Not committed yet — a shortlist to pick from later as priorities become clear:

- Notifications: email or SMS for order confirmation, shipping updates, and low-stock alerts to store owners
- Coupons and discount codes
- Product reviews and ratings
- Wishlist / favorites
- Basic support channel or contact form routed to the store owner

## Design priority

A clean, modern storefront UI is a top priority, not an afterthought — the customer's shopping experience should feel smooth and inviting, since that drives whether they complete a purchase. This means thoughtful spacing and typography, fast page loads, clear product imagery, a frictionless cart and checkout flow, and a design that adapts well to mobile, since most shoppers will browse from a phone.

Most customers are expected to shop from a mobile phone, with only a small share on laptop or desktop, so the build is mobile-first: designed and tested for phone screens first, then scaled up to tablet and desktop, not the other way round. Every page — homepage, product grid, cart, checkout — must work comfortably across all device sizes.

## Configuration over code

The guiding rule for this codebase: a new store should never require new code, only new configuration. Everything that differs between tenants — branding, theme color, category fields, which features are switched on, homepage content, domain — lives in the tenant's config record, not in a code branch or a separate deployment.

In practice this means launching a new store is: create a tenant record, pick a category template, set branding and a subdomain, and it's live — the same codebase and deployment already serving every other tenant now serves this one too. No redeploy, no custom code per customer, which is what makes onboarding many shops quick and repeatable.

Target: a new store should go live within hours, same day at most. With configuration-only onboarding, the steps are: create the tenant record and subdomain, pick a category template, set branding and store details, and the admin or store owner uploads their product list — no coding or redeployment in that path, so the time is mostly how fast the store's own product and branding details are gathered, not the technical setup.

## Roadmap

1. MVP — single tenant working end to end: product listing, cart, checkout, order placement, basic store-owner dashboard.
2. Multi-tenancy — add `tenant_id` throughout, subdomain routing, tenant settings and theming, row-level security.
3. Category templates — pre-built field sets and categories for pharmacy, hardware, and grocery, selectable at sign-up.
4. Payments and notifications — online payment integration, order status emails or SMS.
5. Polish and scale — search, analytics dashboard, image optimization, move off free tiers as usage grows.
