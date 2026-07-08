# MyOrchard App

Production-oriented web UI for Kalpavriksha Agro's MyOrchard program.

## Run locally

```bash
python -m http.server 5177 --bind 127.0.0.1
```

Open `http://127.0.0.1:5177/`.

## Access

- Farmer and Supporter use the sign-in/sign-up flow on the welcome screen.
- Team/admin tools are hidden from public users and only appear after signing in with an approved team email.
- Team emails currently allowed in the frontend gate:
  - `admin@myorchard.app`
  - `admin@kalpavrikshaagro.com`
  - `team@kalpavrikshaagro.com`
  - `raashifshaikh70@gmail.com`

## Notes

The app initializes the Supabase browser client with the project publishable key and anon fallback. On startup it restores the Supabase Auth session, reads `program_settings`, `orchards`, `verifications`, `farmer_updates`, and `adoptions`, and shows intentional empty states when no live rows are published.

The sign-in/sign-up flow uses Supabase Auth. New accounts may require email confirmation depending on the Supabase project setting. Admin access is checked against the `app_admins` table and should be enforced with the RLS policies in `supabase/schema.sql`.

Do not place the Postgres pooler/database connection string in this frontend repo. Keep it server-side only.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor to create or upgrade the tables and RLS policies expected by the UI. The schema includes profiles, admin email checks, farmer verification writes, adoption/certificate records, farmer updates, and admin-managed program settings.
