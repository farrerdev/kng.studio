# KNG.studio Architecture

KNG uses a feature-first structure. New work should live near the domain it changes, not in the root app shell.

## Structure

- `src/App.tsx`: thin compatibility entrypoint only.
- `src/app/`: app shell, route/path helpers, top-level composition.
- `src/features/catalog/`: catalog data API, product selectors, slug/title/price helpers.
- `src/features/storefront/`: customer storefront behavior and UI.
- `src/features/storefront/cart/`: cart types, totals, localStorage, order image generation.
- `src/features/admin/`: admin screens and admin-only components.
- `src/features/analytics/`: anonymous storefront event tracking and admin stats fetchers.
- `src/shared/`: reusable UI, icons, and pure utilities with no KNG business ownership.
- `src/styles.css`: CSS entrypoint only.
- `src/styles/kng.css`: current consolidated KNG CSS. Split future large CSS by feature once a section is actively changed.

## Rules For New Features

- Do not add new feature logic to `src/App.tsx`.
- Prefer adding a screen/component/service under the closest `src/features/*` folder.
- Keep API/Supabase code out of presentational components.
- Keep formatting, image URL, reorder, and money helpers in `src/shared/utils`.
- Keep feature-specific types next to that feature unless several features share them.
- Keep `src/styles.css` thin. Add future feature styles under the owning feature or `src/styles/`, then import them from the entrypoint.
- Preserve anonymous analytics: do not store IP, user agent, session id, phone, name, or cart snapshots.

## Verification

Run `npm run build` after UI or data changes. The build includes layout guards for important storefront spacing and divider regressions.
