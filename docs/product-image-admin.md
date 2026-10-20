# Admin accounts and product image uploads

The app-managed admin sign-in is available at `/admin`. Account records and hashed passwords are stored in PostgreSQL in `public.admin_accounts`; sessions are opaque random tokens whose SHA-256 hashes are stored in `public.admin_sessions`. Supabase Auth is not used for admin access. Passwords are bcrypt-hashed and never stored in plaintext.
Admin account IDs and their session references use PostgreSQL integers.

## Configure the app

Set these environment variables locally and in the deployment environment:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@your-host:5432/postgres?sslmode=require
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
SUPABASE_PRODUCT_BUCKET=Sulthan_porur
SULTHAN_HARDWARE_TENANT_ID=1001
```

`DATABASE_URL` is a server-side database credential. Keep it private and use a restricted database role where practical. `SUPABASE_SERVICE_ROLE_KEY` must be a Supabase secret key (or legacy `service_role` key); a publishable/anon key cannot upload to Storage. It is server-only and is needed for image uploads and signed URLs for a private bucket. Do not prefix it with `NEXT_PUBLIC_` or commit any secret values. Restart the app after environment changes.

Images must be JPEG, PNG, or WebP and no larger than 5 MB. Images are saved under a tenant folder in the configured Storage bucket. Product paths and details are stored in `public.products`; storefronts load active products from that table and receive short-lived signed image URLs.

Each storefront slug maps to its database ID using server-side configuration such as `SULTHAN_HARDWARE_TENANT_ID`, not a hard-coded ID. API routes verify the configured ID and slug match `public.tenants`, and associate product records with that ID. Admin role and tenant assignment are read from `public.admin_accounts`.

## Prepare the database and create the first admin

1. For a new database, apply `supabase/migrations/001_initial_multi_tenant.sql`. For the existing database, make sure `supabase/migrations/002_integer_tenant_ids_and_rls.sql` has already been applied.
2. Apply `supabase/migrations/003_application_admin_accounts.sql` to create the admin account and session tables.
3. Apply `supabase/migrations/004_integer_public_entity_ids.sql` to use integer IDs for public application entities. The migration keeps the Supabase Auth user ID as text and stops rather than converting populated UUID-based tables without an explicit ID mapping.
4. Set `DATABASE_URL` and `SULTHAN_HARDWARE_TENANT_ID` in `.env.local`, and ensure the configured tenant exists.
5. Run `npm run admin:create-super` in an interactive terminal to create the first super admin. Enter the admin email and temporary password at the hidden prompts. The password must be at least 12 characters; it is not echoed, logged, or saved as plaintext. Use `npm run admin:create` to create a store owner for the configured tenant.
6. Give the owner the initial credentials through a secure channel. On first sign-in, the app requires them to set a different password. Their session is revoked after changing it.

The sign-in page has no unauthenticated email-based password reset, since no mail delivery/recovery provider is configured. An operator can reset an account by running `npm run admin:reset-password` in an interactive terminal; all existing sessions are revoked and the user must change the replacement password at next sign-in.

Super admins can manage accounts at `/admin/accounts`: create, edit, assign roles and stores, set temporary passwords, and delete accounts. Store owners cannot access this screen or its API. Setting a temporary password revokes the target account's sessions and requires a password change at next sign-in. The final super admin cannot be demoted or deleted, and an admin cannot delete their own account.

## Database migrations

The admin tables have row-level security enabled, and access is granted only through the server's `DATABASE_URL` connection. Apply migrations using the Supabase SQL editor or your established migration workflow. Never send database credentials through chat.

If database or Storage configuration is missing or a request fails, the app returns an explicit error rather than reporting a successful product load or upload.
