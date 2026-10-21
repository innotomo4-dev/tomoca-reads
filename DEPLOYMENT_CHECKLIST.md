# TOMOCA Reads — Vercel + Supabase deployment checklist

Use this after extracting the release ZIP.

## 1. Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/migrations/001_tomoca_reads.sql` once.
3. Copy the project URL and the server-only secret key (`sb_secret_...`).
4. Do **not** expose the secret key in a `NEXT_PUBLIC_*` variable.

## 2. Stripe

1. Create a product named TOMOCA Reads.
2. Create an active recurring price of exactly **$20 USD / month**.
3. Copy its `price_...` ID.
4. After the first Vercel deployment, add a webhook endpoint at:
   `https://YOUR-DOMAIN/api/stripe/webhook`
5. Subscribe it to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
6. Copy the webhook signing secret (`whsec_...`).
7. Enable/configure Stripe Customer Portal if you want the **Manage subscription** button to work.

## 3. Secrets

Generate three different values:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Use them for `ADMIN_SETUP_TOKEN`, `RATE_LIMIT_SECRET`, and `CRON_SECRET`.

## 4. Vercel environment variables

Set:

- `SITE_URL`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `ADMIN_SETUP_TOKEN`
- `RATE_LIMIT_SECRET`
- `CRON_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

The optional retention/RSS settings are documented in `.env.example`.

## 5. GitHub and Vercel

1. Push the extracted project to a **private GitHub repository**.
2. Import that repository into Vercel as a Next.js project.
3. Deploy first on the Vercel preview/production domain.
4. After installing dependencies once, commit the generated `pnpm-lock.yaml` to the private repository.
5. Connect the final custom domain, update `SITE_URL`, and redeploy.

## 6. First administrator

Open `/admin`. If no administrator exists, activate it using `ADMIN_SETUP_TOKEN`, an email address, and a password of at least 14 characters. Then sign in.

## 7. Billing and QR test

1. In `/admin`, start the Stripe subscription in Stripe test mode first.
2. Confirm the signed webhook changes the dashboard subscription state to **Active** or **Trial active**.
3. Choose a branch and display its QR.
4. Confirm the QR stays the same for that branch for the Addis Ababa calendar day.
5. Scan it from two separate browsers/devices; each must receive its own 30-minute reader session.
6. Confirm customers are never sent to Stripe and never asked to pay.
7. Confirm an inactive subscription prevents new QR scans.

## 8. Release checks

```bash
pnpm install
node tests/static.mjs
pnpm build
pnpm lint
```

The release was statically validated before packaging. A complete dependency install/build could not be executed in the packaging environment because its npm registry DNS was unavailable, so the commands above are the final deployment gate.
