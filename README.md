# MyOrchard App Prototype

Static UI prototype for Kalpavriksha Agro's MyOrchard program.

## Run locally

```bash
python -m http.server 5177 --bind 127.0.0.1
```

Open `http://127.0.0.1:5177/`.

## Mock access

- Farmer and Supporter are public demo flows.
- Team/admin tools are hidden from public users.
- Mock team emails:
  - `admin@myorchard.app`
  - `admin@kalpavrikshaagro.com`
  - `team@kalpavrikshaagro.com`

## Notes

The app initializes the Supabase browser client with the project publishable key and anon fallback. On startup it tries to read `orchards`, `verifications`, and `farmer_updates`; if those tables are empty or not created yet, it keeps the polished local mock data visible so the UI never breaks during demos.

Do not place the Postgres pooler/database connection string in this frontend repo. Keep it server-side only.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor to create the starter tables, RLS policies, and demo rows expected by the UI. Tighten the prototype read policies before production launch.
