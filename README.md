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

The app currently uses local mock data. Supabase can be connected later for authentication, profiles, farms, adoptions, payments, certificates, and admin verification records.
