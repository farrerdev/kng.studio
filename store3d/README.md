# KNG.studio · 3D shop

Walk-in 3D version of the shop, meant for its own subdomain. It is a separate app (own
`package.json`, dev server, build and Vercel project). Nothing in the main storefront imports it.

## Shopping UI = the main store's components

The 3D app adds only the scene and its navigation (HUD menu/cart buttons, spots, shelves). All
shopping UI is the main store's own `<Storefront>` (`../src/features/storefront/Storefront.tsx`)
rendered by `src/shop/mountShop.tsx` with the linen theme (`:root[data-theme="linen"]` in
`../src/styles/tokens.css`):

- product list (popular rail, grid with type filter, policies) and product page: a full-screen
  layer over the scene, closed with the ← button in its header;
- cart, checkout (order image, Instagram/Messenger), menu drawer and lightbox: float over the scene;
- spot panels (shelf, podium, mannequins) show products with the storefront's own `ProductRail`
  cards (the podium uses the numbered "Đang được yêu thích" overlay cards).

In scene mode the storefront has no URLs or page meta; the scene drives it through
`StorefrontController` (`openProduct`, `openHome`, `openCart`, `openMenu`, `closePage`) and gets
`StorefrontSceneState` back (page open, anything open, cart quantity). **Change the shop only in
the main store**; this app picks it up. The catalog also comes from the main store
(`fetchStorefrontCatalog`), and `src/data/sceneCatalog.ts` derives the shelves from it with the
storefront's own rules (listed products, order, titles, prices, popular ranking).

The cart is shared with kngstudio.shop: besides localStorage (per origin), the storefront keeps the
cart lines in a `kng_cart` cookie on the parent domain and rebuilds names/prices/images from the
catalog (`../src/features/storefront/cart/sharedCart.ts`). Newest change wins; a tab picks up
changes from the other site when it regains focus. In dev the cookie is host-only, which still
spans ports, so :5173 and :5180 share a cart too.

## Run

```bash
npm ci --prefix ..   # the shared components use the repo root's packages (React, lucide-react)
npm install
npm run dev          # http://localhost:5180
npm run build        # type-check + production build into dist/
```

Env: reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the repo-root `.env.local`
(`envDir: ".."`), the same public read-only keys the storefront uses.

## Deploy (Vercel) — https://3d.kngstudio.shop

Ship the main store first: the 3D shop renders its components and shares its cart cookie.

1. Vercel → Add New → Project → import `farrerdev/kng.studio` again (a second project next to
   `kng.studio`).
2. Root Directory: `store3d`, and keep "Include source files outside of the Root Directory" on.
   Framework, install/build commands and output come from `store3d/vercel.json`.
3. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as the main
   project).
4. Settings → Domains: add `3d.kngstudio.shop`. DNS is at Tenten: add a `CNAME` record `3d` →
   the target Vercel shows (e.g. `cname.vercel-dns.com`).

`vercel.json` also: installs the repo-root packages (`npm ci --prefix ..`), proxies `/api/catalog`
to the live shop's CDN-cached catalog, and skips builds when a commit touches neither `store3d/`
nor the shared `src/` (`ignoreCommand`). The main project is unchanged.

## Data

The left wall is a clothing rail: one equal-width section per listed product, in storefront order.
Each hangs the product as a set drawn from the approved concept (`src/scene/furniture/garments.ts`:
outlines kept as concept path data; cut from the type name, collar/buttons/lace from the model
name; the tank set is solid peach), with a name + cut/price tag above and its other patterns
folded on the cabinet below. The mannequin stands show the two newest products the same way.
Prints are drawn on a canvas (`src/scene/prints.ts`), coloured from the pattern name ("Cúc ban
mai" → daisies on butter, "Hoa nơ đỏ" → red bows…); product photos are not used as textures.
The "Đang được yêu thích" podium shows the storefront's popular ranking (top 5).

The scrunchie stand is decor: a matching scrunchie is a gift with every set, not a product.

## Structure

```
src/
  app/        StoreApp (renderer, loop, actions), zoneViews (panel copy per spot)
  camera/     FollowOrbitCamera (drag orbit, wheel/pinch zoom, eased follow)
  characters/ HumanFigure, Player (guest), ShopOwner (NPC), Cat (Min)
  config/     layout (floor plan in metres), palette, env
  data/       sceneCatalog (shelf data from the storefront catalog), types
  input/      InputController (mouse, touch, keyboard), Joystick (touch thumbstick)
  scene/      room, furniture/*, materials, textures, canvasArt
  shop/       mountShop (main store <Storefront> in scene mode), types
  ui/         Hud (top bar, spot panel, toasts, reopen chip) + hud.css
  world/      collision, zones
```

Performance notes: the engine chunk is lazy-loaded after the loader paints; static furniture
has frozen matrices and a one-time shadow map; moving characters use blob shadows; fabric
textures load lazily (4 at a time); pixel ratio is capped at 2 and drops automatically below
~45 fps.
