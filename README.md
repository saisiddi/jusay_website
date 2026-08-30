# Jusay — website

Marketing site and self-serve account portal for Jusay, a system-wide voice layer for your OS: speak naturally and get polished text in any app.

## Stack

- [Vite](https://vitejs.dev) 5
- [React](https://react.dev) 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com)
- [framer-motion](https://motion.dev) for animation
- [Supabase](https://supabase.com) for auth and entitlements

## Getting started

```sh
npm install     # install dependencies
npm run dev     # dev server on http://localhost:8080
npm run build   # production build into dist/
npx vitest run  # run the test suite once
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/login` | Email auth |
| `/account` | Plan, entitlement and download |
| `/auth/web-callback` | Supabase redirect target for the web session |
| `/about` | About Jusay |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/contact` | Contact |
| `/modes/ai`, `/modes/grammar`, `/modes/notes`, `/modes/rewrite` | Mode detail pages |

The desktop OAuth hand-off lives at the static `public/auth/callback/` page rather than a SPA route, because it relays tokens to the local desktop app.

## Environment

Copy `.env.example` to `.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Both are browser-safe. The anon key is a public key guarded by Supabase Row Level Security — never put a service-role key in a `VITE_` variable. `src/lib/supabase.ts` also carries these values as inline fallbacks so the deployed site works before the env vars are configured.

## Database

`supabase/stats.sql` is run once by hand in the Supabase SQL Editor to create the public download and view counters. It is idempotent, so re-running it is safe.
