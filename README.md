# MultiTenantApp

This app can support both mobile and web for multiple customers.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## WhatsApp quotes

Set `APP_OWNER_WHATSAPP_NUMBER` in `.env.local` to the store owner's WhatsApp number in international format using digits only, including the country code (for example, `919876543210`). Restart the development server after changing the value.

In the storefront cart, shoppers enter their mobile number with a leading `+` and country code (for example, `+919876543210`). The app checks the number's format, saves the quote and reduces inventory in PostgreSQL when they submit, then opens WhatsApp with a message containing the tenant, cart items, authoritative prices, total, shopper's number, and quote reference. The shopper must review and send the message; this does not automatically place an order or verify that the phone number belongs to them. Apply `supabase/migrations/006_storefront_quotes.sql` before enabling quote checkout.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
