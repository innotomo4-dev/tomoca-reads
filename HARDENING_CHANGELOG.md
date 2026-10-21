# TOMOCA Reads — Vercel/Supabase conversion

## Changed in this release

1. Replaced all SQLite/D1 persistence with server-side Supabase PostgreSQL.
2. Removed the self-hosted/Vinext/Cloudflare runtime split; Vercel runs native Next.js.
3. Daily branch QR: one cryptographically random token per branch per Addis Ababa calendar day.
4. Unlimited customers may use the valid daily QR; each scan creates an independent 30-minute session.
5. Reader session IDs are now hashed in the database rather than storing the raw cookie token.
6. Added a real Stripe subscription flow for the TOMOCA/business administrator.
7. Added signed Stripe webhook handling and Supabase-backed subscription status.
8. New QR scans are gated on an `active` or `trialing` business subscription; customers never pay.
9. Added Stripe Customer Portal support for subscription management.
10. Preserved 600k PBKDF2 admin password hashing, hashed admin sessions, origin checks, login throttling, security headers, RSS destination/size/timeout protections, privacy deletion, and durable branch metrics.
11. Added Supabase RLS with no anonymous browser database access.
12. Added Vercel-compatible daily maintenance, distributed refresh locking, `/healthz`, and `/readyz`.

See `README.md` and `supabase/migrations/001_tomoca_reads.sql` for deployment.
