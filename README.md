# SmartShop — online store

An e-commerce storefront with accounts, checkout and an admin panel. Built with
Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, MongoDB, and
react-hook-form + zod for every form.

```bash
cp .env.example .env.local   # add MONGODB_URI and AUTH_SECRET
npm run seed                 # load catalogue + demo accounts into MongoDB
npm run dev                  # http://localhost:3000
```

The app also runs with no database at all — see [Without a database](#without-a-database).

## Routes

| Route              | What it does                                                            |
| ------------------ | ----------------------------------------------------------------------- |
| `/`                | Hero, delivery promises, category tiles, featured products, promo banner |
| `/products`        | Catalogue with search, category filter and sorting (all URL-driven)      |
| `/products/[slug]` | Product detail, stock state, quantity picker, related products           |
| `/cart`            | Line items, quantity editing, order summary                              |
| `/checkout`        | Delivery details form, places the order, shows the reference             |
| `/login`           | Sign in                                                                  |
| `/signup`          | Create an account                                                        |
| `/admin`           | Revenue, order counts, recent orders — **admin role only**               |
| `/admin/orders`    | Every order with customer details; change status inline                  |
| `/admin/products`  | Product list with delete, plus the add-product form                      |

## Theme

Two colours, everything else is neutral:

- **Brand — teal** (`brand-50` … `brand-900`): primary actions, links, active states.
- **Accent — coral** (`accent-100` … `accent-700`): discounts, highlights, the warm half.

Both live in `src/app/globals.css` alongside neutral tokens (`surface`, `ink`,
`muted`, `line`), each with a dark-mode value. Components reference those names
rather than raw Tailwind colours, so retheming the whole site is one file.

Order-status colours (amber / sky / emerald / rose) sit deliberately outside the
pair — they carry meaning, not decoration, and always ship with a text label so
state is never communicated by colour alone.

## Imagery

The homepage hero is `public/hero-bag.jpg` — photo by
[Irene Kredenets](https://unsplash.com/photos/woman-holding-blue-leather-handbag-jKoRZkv2o0U)
on Unsplash, free for commercial use under the
[Unsplash License](https://unsplash.com/license). Attribution is not required but
is kept here as a record of where it came from.

To change the hero, replace that file — nothing else needs editing. The store
name sits over it with two overlays (a brand-teal wash and a left-to-right
darkener) so the text keeps its contrast whatever photo is behind it.

### Product images

The add-product form takes an image two ways: upload a file, or paste a URL.
Leave both blank and `ProductImage` draws a category illustration instead.

Uploads go to `public/uploads/` through a Server Action
(`src/lib/admin/upload.ts`) and are stored under a generated UUID filename. The
action is admin-only and checks, in this order:

- **Size** — 5 MB maximum. `serverActions.bodySizeLimit` in `next.config.ts` is
  set to 6mb because the framework default is 1MB.
- **Real format** — JPG, PNG and WebP, detected from the file's leading bytes.
  The browser-sent MIME type and the filename are both attacker-controlled, so
  a `.jpg` that is actually something else is rejected.
- **No SVG** — it can carry script, and these files are served from the site's
  own origin.

The stored filename is generated, never taken from the upload, so a crafted
name cannot escape the directory or overwrite an existing file.

`public/uploads/` is gitignored (except `.gitkeep`) — it is user content, not
source.

> **Deploying:** this writes to the local filesystem, which works on a normal
> server or a VPS but not on serverless hosts like Vercel, where the filesystem
> is read-only and wiped between invocations. Moving to S3, Cloudinary or
> UploadThing means rewriting only `src/lib/admin/upload.ts`.

## Auth

- Passwords are hashed with `scrypt` (`src/lib/auth/password.ts`), never stored raw.
- The session is a signed cookie — `base64url(payload).base64url(HMAC-SHA256)` —
  set httpOnly, `sameSite: lax`, and `secure` in production. No session store, so
  signing out is just clearing the cookie. See `src/lib/auth/session.ts`.
- `AUTH_SECRET` signs those cookies. Production refuses to start without it; in
  development it falls back to a fixed dev string.
- `/admin` is guarded in `src/app/admin/layout.tsx`, **and** every admin server
  action re-checks the role independently — a server action is its own HTTP
  endpoint and cannot rely on the page guard.
- A signed-in non-admin hitting `/admin` is sent to `/`, not shown a 403, so the
  panel's existence is not advertised.

### Demo accounts

Seeded into MongoDB by `npm run seed`, and recreated automatically when running
without a database. They are listed on the sign-in page. **Remove them before
going live** — see `src/lib/db/demo-accounts.ts`.

| Email                 | Password    | Role     |
| --------------------- | ----------- | -------- |
| `admin@smartshop.pk`  | `Admin1234` | admin    |
| `demo@smartshop.pk`   | `Demo1234`  | customer |

## Forms

Every form uses react-hook-form with a zod resolver. The schemas live in one
place — `src/lib/validation.ts` — and the matching server action re-parses with
the same schema, so the browser and the server can never disagree about what is
valid. Client-side validation is for feedback; the server check is the one that
counts.

Checkout never trusts prices from the browser: the action takes only product ids
and quantities, then re-prices from the catalogue and re-checks stock.

## Database

| Collection   | `_id`         | Notes                                        |
| ------------ | ------------- | -------------------------------------------- |
| `products`   | product id    | Indexed on `slug` (unique), category, featured, price |
| `categories` | category slug | `name`, `position`                            |
| `users`      | uuid          | Unique index on `email`; holds `passwordHash` |
| `orders`     | uuid          | Indexed on `createdAt`, `status`              |

All reads and writes go through `src/lib/db/*.ts`. Nothing else in the app talks
to MongoDB, so queries change in one place. `src/lib/db/mongo.ts` holds the
connection; the client promise is parked on `globalThis` so Next.js module
reloads in development don't open a new pool on every edit.

### Without a database

With no `MONGODB_URI`, the repositories fall back to in-memory data and print a
warning, so the whole app still runs:

- Products come from `src/lib/db/seed-products.ts`.
- Orders start from five sample orders, so the admin panel has something to show.
- The two demo accounts are recreated on every start.

**Accounts and orders created in that mode are lost when the dev server
restarts.** In production the fallback throws instead — quietly serving fake
stock and dropping real orders would be worse than failing. That also means
`npm run build` needs a reachable database.

## Rendering

The root layout reads the session cookie to render the header, which makes every
route render per request. Prices, stock and the signed-in state are therefore
always current, at the cost of static generation.

## Before going live

The app is a working demo, not a shop that is ready for customers. `npm run build`
fails on purpose until the first two boxes are ticked.

**Environment — done**

- [x] `MONGODB_URI` — pointed at the `smartshop` database on the existing Atlas
      cluster. Products, users and orders persist across restarts, and
      `npm run build` succeeds.
- [x] `AUTH_SECRET` — generated and set in `.env.local`.
- [ ] Rotate the Atlas password, or give this project its own database user.
      The connection string was shared in chat, so treat it as exposed.

**Security**

- [ ] Delete the demo accounts (`src/lib/db/demo-accounts.ts`) and the credentials
      box on the sign-in page, then create a real admin with a strong password.
      As it stands those passwords are printed on the login page.

**Content that is not real**

- [ ] The 14 products in `src/lib/db/seed-products.ts` are invented — names,
      prices and descriptions. Replace them with the real catalogue.
- [ ] Every product carries an invented `rating` and `reviewCount`. Showing
      made-up reviews to customers is deceptive and is regulated in most
      markets. Either build real reviews or drop both fields from the UI.
- [ ] The five sample orders in `src/lib/db/orders.ts` only appear in the
      no-database fallback. Now that MongoDB is connected the orders list starts
      empty and fills with real ones, so this is no longer visible — but the
      sample data is still in the file.

**Hosting**

- [ ] Image uploads write to `public/uploads/`, so a serverless host such as
      Vercel will not keep them. Use a VPS, or move `src/lib/admin/upload.ts`
      to object storage.
- [ ] Payment is cash on delivery only.

## Not built yet

- Online payment — orders are cash on delivery.
- Editing an existing product (add and delete only).
- Customer-facing order history.
