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

The app initializes the Supabase browser client with the project publishable key and anon fallback. On startup it reads `orchards`, `verifications`, and `farmer_updates`; if no rows are published yet, the UI shows intentional empty states instead of placeholder records.

The current sign-in/sign-up flow is a launch UI mock until Supabase Auth is connected. Enforce admin access with Supabase Auth roles and RLS policies before production data goes live.

Do not place the Postgres pooler/database connection string in this frontend repo. Keep it server-side only.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor to create the starter tables and RLS policies expected by the UI. Tighten public read policies before production launch.
