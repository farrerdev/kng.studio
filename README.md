# kng.studio

Mock customer catalog for KNG.studio homewear products.

## Run locally

```bash
npm install
npm run dev
```

Customer catalog runs at `/`. Admin runs at `/admin`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create an admin user in Supabase Auth.
4. Copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

5. Start the app and log in at `/admin`.

Images are uploaded to the public `catalog-images` bucket. If Supabase env vars are missing, the customer site falls back to local mock data and `/admin` shows setup instructions.

## Build

```bash
npm run build
```

## Deploy

Deploy the repository to Vercel as a Vite project. The production build command is `npm run build` and the output directory is `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project environment variables.

## Update shop links

Edit `src/config/shop.ts` and replace the placeholder Instagram/Facebook URLs with the real messaging links.
