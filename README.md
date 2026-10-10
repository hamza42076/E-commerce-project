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
| `/products/[slug]` | Colour swatches, per-colour gallery and stock, quantity, add to cart     |
| `/cart`            | Line items per colour, quantity editing, order summary                   |
| `/checkout`        | Delivery details form, places the order, shows the reference             |
| `/login`           | Sign in                                                                  |
| `/signup`          | Create an account                                                        |
| `/forgot-password` | Asks for a reset link by email                                           |
| `/reset-password`  | Sets a new password from the link in that email                          |
| `/admin`           | Revenue, order counts, recent orders — **admin role only**               |
| `/admin/orders`    | Every order with customer details and the colour ordered; status inline  |
| `/admin/products`  | Product list with edit and delete, plus the add-product form             |
| `/admin/products/[slug]/edit` | The same form, pre-filled — add, remove and re-stock colours  |

## Client state

Three zustand stores in `src/stores/`, imported directly by the components that
need them. There are no context providers wrapping the tree.

| Store | Holds | In localStorage |
| ----- | ----- | --------------- |
| `auth` | signed-in user, API token | yes, until sign-out |
| `cart` | lines, and the catalogue they resolve against | lines only |
| `ui` | cart drawer, toasts | no |

`StoreHydrator`, rendered once in the root layout, pushes in the two things
only the server knows: the catalogue, and who the session cookie says is signed
in.

**The auth store does not authorise anything.** Every page guard and every
server action reads the httpOnly session cookie, because a server component
cannot see localStorage and a value the browser can write is not evidence.
Editing `role` in devtools changes what the menu shows and nothing else;
`/admin` still refuses you. If the cookie has expired, the next page load
clears the store to match.

That cookie is also where the security sits: script injected into the page
cannot read an httpOnly cookie, but it can read localStorage. The token kept
there is a convenience for calling the JSON API from the browser, not the thing
protecting the account — and it is worth knowing that an XSS would hand it over.

Carts written before the stores existed (`cart:v1`, `cart:v2`) are read once,
merged in, and removed, so nobody loses what they left in their basket. The old
keys are cleared even when there is nothing to carry over — left behind, they
would reappear the next time somebody emptied their cart.

Only `{ productId, color, quantity }` is stored. Names, prices and stock come
from the catalogue on every request, so a price change or a withdrawn colour
shows up immediately instead of a stale copy living on in a browser.

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

### Where product images live

Three possible homes, and the difference matters once the site is deployed:

| Location | Written by | In git | Survives a deploy |
| -------- | ---------- | ------ | ----------------- |
| Cloudinary | the upload button, when configured | n/a | **yes** |
| `public/products/` | you, committing a file | yes | **yes** |
| `public/uploads/` | the upload button, as a fallback | no | **no** |

`public/uploads/` is gitignored because it is meant for user content, not
source. On a serverless host its filesystem is read-only and thrown away
between invocations, so anything written there is gone. That is why the upload
button prefers Cloudinary and logs a warning when it falls back.

A file you want to ship with the code — the catalogue's own photography —
belongs in `public/products/`, referenced as `/products/name.png`.

### Cloudinary

Configure it and the upload button starts using it; leave it blank and the
button writes to `public/uploads/` as before, logging a warning.

Either paste the single URL the Cloudinary dashboard shows:

```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

or set the three separately. The combined URL wins if both are present.

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**Delivered images are optimised.** Every returned URL carries
`f_auto,q_auto`, so Cloudinary converts on the fly to whatever the browser
accepts at a quality that looks the same. The catalogue photograph goes from a
2.1 MB PNG to a 176 KB WebP — on mobile data that is the difference between a
page that opens and one that does not. The original upload is left alone.

Uploads are **signed on the server** (`src/lib/admin/cloudinary.ts`): the API
secret never reaches the browser. An unsigned preset would be less code but
would let anyone who learned the cloud name upload into the account.

Cloudinary is not trusted to police what arrives. The admin check, the 5 MB cap,
the magic-byte sniff and the SVG refusal all run first, exactly as they do for a
local write — only the destination changes.

The signing routine is checked against Cloudinary's own two documented examples;
run that check with the other helper tests.

> Deleting a product does not delete its Cloudinary images. They are small and
> orphaned rather than harmful, but they do accumulate.

### Product images

The add-product form takes an image two ways: upload a file, or paste a URL.
Leave both blank and `ProductImage` draws a category illustration instead.

Uploads go through a Server Action (`src/lib/admin/upload.ts`) — to Cloudinary
when it is configured, otherwise to `public/uploads/` under a generated UUID
filename. The checks below run before either, and are the same in both cases.
The action is admin-only and checks, in this order:

- **Size** — 5 MB maximum. `serverActions.bodySizeLimit` in `next.config.ts` is
  set to 6mb because the framework default is 1MB.
- **Real format** — JPG, PNG and WebP, detected from the file's leading bytes.
  The browser-sent MIME type and the filename are both attacker-controlled, so
  a `.jpg` that is actually something else is rejected.
- **No SVG** — it can carry script, and these files are served from the site's
  own origin.

The stored filename is generated, never taken from the upload, so a crafted
name cannot escape the directory or overwrite an existing file.

See [Where product images live](#where-product-images-live) for which of the
three destinations a given file should end up in, and why the local one does
not survive a deploy.

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

### The sign-in form names the reason, and is rate limited for it

The form says "no account uses this email address yet" when the address is
unknown, and "that password is not correct" when it is not. The usual advice is
one message for both, so the form cannot be asked which addresses have
accounts.

That was the wrong trade for this shop. Almost every failed sign-in here is a
first-time visitor who has not registered, or somebody who typed their address
wrong — and a single message leaves both of them guessing which half to change.
A real customer who cannot get in does not try harder; they leave.

What makes the honest message affordable is `src/lib/auth/rate-limit.ts`:

| Counter                | Limit               | Window |
| ---------------------- | ------------------- | ------ |
| Failed sign-ins per email | 8                | 15 min |
| Failed sign-ins per IP    | 30               | 15 min |
| Reset requests per email  | 3                | 1 hour |
| Reset requests per IP     | 12               | 1 hour |

Eight answers is plenty for someone who has forgotten which address they used,
and useless for harvesting a customer list. Both counters are consumed *before*
the account is looked up, so a caller who is already blocked learns nothing at
all. A successful sign-in clears the counter, so getting it right on the fifth
try does not leave four failures hanging over the rest of the window.

The counters live in MongoDB with a TTL index, not in process memory — a
deployment runs more than one instance, and a limit that resets when the load
balancer picks a different one is not a limit. `POST /api/auth/login` shares
the same counters, so throttling the form is not something a caller can step
around by posting to the API instead. That endpoint keeps the single generic
message: an API client has nobody to be kind to.

The per-IP limit is deliberately the looser of the two. A household, an office
and a mobile network all share one address, and `x-forwarded-for` is a request
header that anyone can write anything in, so it is a sorting key rather than an
identity.

### Password reset

`/forgot-password` emails a link; `/reset-password` spends it. Specifics worth
knowing, in `src/lib/db/password-resets.ts`:

- The link is 32 random bytes, and what the database stores is its SHA-256.
  Reading the collection tells you that somebody asked for a reset, not how to
  complete one.
- It is **not** one of the signed tokens from `src/lib/auth/token.ts`. Those
  carry their own validity, which is exactly wrong here: a reset link has to
  stop working the moment it is used, and nothing self-contained can be
  withdrawn. So there is a row, and it is deleted on use.
- Single use and one hour. Spending it is a `findOneAndDelete`, so two requests
  arriving together cannot both succeed. Asking for a second link kills the
  first.
- The page checks the link on load without spending it, so a stale link says so
  before anybody picks a password and types it twice.
- A successful reset signs them in. Reading the link proves they hold the
  mailbox, which is what the password proves too.
- Reset requests get the same honest answer about unknown addresses as sign-in,
  for the same reason — a typo would otherwise leave somebody watching an inbox
  for a message that was never coming.
- If the email fails to send, the link is withdrawn and the failure is reported.
  A live token for a message nobody received is pointless risk.

The link's host comes from `NEXT_PUBLIC_SITE_URL`, or Vercel's own environment,
and in production never from the request's `Host` header — see
`src/lib/site-url.ts`. A reset email is the one place where trusting that header
would matter: `Host: attacker.example` would send a real token for a real
account, to its real owner, pointed at somebody else's server.

One honest limitation: sessions are stateless, so changing a password does not
invalidate a session already signed in elsewhere. It stays valid until it
expires, at most a week. Fixing that properly means a token version on the user
record, checked on every request.

### Making the administrator

There are no accounts in the code and none are seeded. A known email and
password shipped with a repository means every deployment of it starts life
with a published way in.

Customers sign up through the site. The administrator is made from the command
line, against whichever database `.env.local` points at:

```bash
npm run admin -- you@example.com "a strong password" "Your Name"
```

Re-running it for the same email changes that account's password instead of
creating a second one, which is the way back in if the administrator's own
mailbox is the one that is unreachable.

The password is typed by you and hashed on the spot; it is not written to any
file. **Do not reuse the password of the mailbox the shop sends from.** If this
database were ever exposed, a password reused there would take the mailbox —
and every order email with it.

## Forms

Every form uses react-hook-form with a zod resolver. The schemas live in one
place — `src/lib/validation.ts` — and the matching server action re-parses with
the same schema, so the browser and the server can never disagree about what is
valid. Client-side validation is for feedback; the server check is the one that
counts.

Checkout never trusts prices from the browser: the action takes only product ids
and quantities, then re-prices from the catalogue and re-checks stock.

### Field components that exist for a reason

- **`EmailField`** (`src/components/form/EmailField.tsx`) suggests a correction
  when the domain looks mistyped — `@gmial.com`, `@gmail.con`, `@yahooo.com`.
  This exists because of four real bounced orders: the address on them was
  `coodinakakeera@gmail.com` instead of `coodingkakeera@gmail.com`, typed the
  same way four times. Nothing rejected it, because it is a perfectly valid
  address; the confirmation simply went nowhere, and from the customer's side
  the shop just never wrote back. Used on sign-in, sign-up, reset and checkout.

  The check runs on blur, not per keystroke — mid-typing, `gmail.c` looks like a
  typo of `gmail.com`. Accepting is always a choice: `@gmail.com.pk` is a real
  domain and a guess that overruled the person typing would be worse than the
  typo.

- **`PasswordField`** reveals what was typed, and warns when Caps Lock is on.
  Both failures look identical in a field of dots: a password typed correctly,
  rejected, with nothing to explain why.

- **`PasswordRequirements`** ticks the rules off as they are met. The rules are
  `PASSWORD_RULES` in `src/lib/validation.ts` and the zod schema is built from
  that same list, so the checklist cannot promise something the server refuses.

- Failures focus the field that needs fixing (`shouldFocus`), which matters most
  on a phone where the red text can be below the fold. Where there is something
  better to offer than "no", the form offers it: an unknown address on sign-in
  gets a **Create an account** button with the address carried over, and an
  address already taken on sign-up gets **Sign in** and **Reset password**.

## The product contract

One shape, named the same thing everywhere: the admin form, the zod schema, the
server action, the MongoDB document, the storefront, the cart, checkout and the
order snapshot. Nothing renames a field on the way through.

```ts
Product {
  id, slug, sku, name, description,
  price, compareAtPrice?,
  category, material?, strapType?, badge?,
  variants: ProductVariant[],
  image, stock,          // pre-variant fallback, see below
  rating, reviewCount, featured?,
  createdAt, updatedAt
}

ProductVariant {
  color,        // "Beige" — unique within a product
  colorCode,    // "#D8C3A5", or "" for none
  image,        // main image for this colour
  images,       // gallery, `image` first
  stock         // this colour's stock
}
```

`src/types/index.ts` is the definition; `src/lib/validation.ts` validates it;
`src/lib/db/mongo.ts` stores it.

### Colour is the source of truth for stock and images

There is no `colors: string[]` beside `variants`. A colour's stock and its
photography live on the variant, because that is what everything downstream
reads: the swatch, the gallery, the stock line, the cart line and the order
snapshot all come from one variant.

`price` stays on the product — colours of the same bag cost the same.

### Variants or the old two fields

Products created before variants existed have an empty `variants` and keep their
`image` and `stock`. Rather than branching at each call site, everything goes
through `src/lib/products/variants.ts`:

| Function | What it answers |
| -------- | --------------- |
| `variantList(product)` | The colours, or one synthetic entry carrying the old `image`/`stock` with `color: ""` |
| `findVariant(product, color)` | The variant for a colour; `""` matches a variantless product |
| `totalStock(product)` | Across colours, or the old `stock` |
| `primaryImage(product)` | What a card shows |
| `galleryFor(variant)` | That colour's images, main first, de-duplicated |
| `cartLineKey(id, color)` | A cart line's identity |

That empty-string colour is how "this product has no colour choice" is spelled
throughout — in the cart, in checkout and in an order item. No colour name is
invented for an older product.

`image` and `stock` on a product written *by this app* are a derived mirror of
the variants (first in-stock image, summed stock), written in one place in
`src/lib/db/products.ts`. They exist because the listing queries and older
documents read them; they are never edited independently.

### Stock

Stock belongs to a colour. Checkout validates against the selected colour, not
the product total — a bag sold out in red is still buyable in black.

An order decrements the colour it was placed for, through a single conditional
update:

```js
updateOne(
  { _id, variants: { $elemMatch: { color, stock: { $gte: quantity } } } },
  { $inc: { "variants.$.stock": -quantity, stock: -quantity } },
)
```

The check and the decrement are one operation, so two orders landing together
cannot both pass and oversell. Lines are reserved one at a time; if a later line
loses that race, the earlier reservations are put back before the error is
returned.

> **Known limit:** reserving stock and writing the order are separate
> operations, not one transaction. If the order write fails the reservations are
> released in a `catch`, but a process killed between the two would leave stock
> reserved for an order that was never written. Atlas supports transactions, so
> this is fixable when it matters.

### Order snapshots

An order item copies in the name, price, colour, colour code and image as they
were at the time. An order therefore still reads correctly after the product is
re-priced, after that colour is removed, and after the whole product is deleted
— verified by doing all three.

### Images

A variant has one `image` and any number of `images`. Both accept an uploaded
`/uploads/...` path or an external URL, validated by the same schema. Uploads go
through the existing action unchanged — magic-byte sniffing, 5 MB cap, no SVG,
generated filename.

## JSON API

A REST API sits alongside the web UI for clients that cannot use Server Actions
— a mobile app, a script, another service.

### Authentication: bearer tokens, not cookies

The API reads `Authorization: Bearer <token>` and **ignores the session
cookie**, on purpose. A cookie is attached by the browser automatically, so a
cookie-authenticated `POST` endpoint can be fired from any other site — that is
CSRF. Next.js protects Server Actions against it; plain route handlers get no
such help. A bearer token has to be attached deliberately, so there is nothing
for another site to abuse, and it is what a mobile client would carry anyway.

Both schemes sign the same payload through `src/lib/auth/token.ts`, so there is
one signing routine rather than two that can drift apart.

Tokens last a week and cannot be revoked before they expire — there is no
server-side session store. That is why there is no logout endpoint: signing out
is the client discarding its token.

### Response shape

```jsonc
// success
{ "data": { ... } }
// failure
{ "error": { "message": "...", "fields": { "password": "..." } } }
```

`fields` appears on 422 responses and comes from the same zod schemas the forms
use.

### Endpoints

| Method | Path | Who | What |
| ------ | ---- | --- | ---- |
| `POST` | `/api/auth/register` | anyone | Creates an account, returns a token |
| `POST` | `/api/auth/login` | anyone | Returns a token |
| `GET` | `/api/auth/me` | signed in | The current account, re-read from the database |
| `GET` | `/api/products` | anyone | `?q=` `?category=` `?sort=` |
| `POST` | `/api/products` | admin | Creates a product, variants included |
| `GET` | `/api/products/[slug]` | anyone | One product plus related ones |
| `DELETE` | `/api/products/[slug]` | admin | Deletes it |
| `GET` | `/api/categories` | anyone | All categories |
| `POST` | `/api/orders` | signed in | Places an order |
| `GET` | `/api/orders` | signed in | Admin gets all; a customer gets only their own |
| `GET` | `/api/orders/[id]` | signed in | Own order, or any order for an admin |
| `PATCH` | `/api/orders/[id]` | admin | `{ "status": "shipped" }` |

Statuses used: `200`, `201`, `400` (no JSON body), `401` (no or bad token),
`403` (wrong role), `404`, `409` (duplicate), `422` (validation).

Which account a request acts as always comes from the token, never from a
parameter — so a customer cannot ask for someone else's orders. Reading another
customer's order answers `404`, not `403`, so the endpoint cannot be used to
discover which order ids exist.

### Example

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your password"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

curl -s localhost:3000/api/orders -H "Authorization: Bearer $TOKEN"
```

### Shared with the web UI

Two pieces of behaviour have two entry points each, so each one lives in a
single module that both call. They differ only in how they authenticate — the
Server Action reads the cookie session, the route handler reads the bearer
token.

| Behaviour | Module | Entry points |
| --------- | ------ | ------------ |
| Placing an order | `src/lib/orders/place-order.ts` | checkout Server Action, `POST /api/orders` |
| Changing a status | `src/lib/orders/update-status.ts` | admin Server Action, `PATCH /api/orders/[id]` |

Pricing, stock checks and the emails are written once. Copied into each, the two
would eventually disagree about what an order costs or who gets told about it.

## Emails

All of them go out through `after()`, so a slow or unreachable SMTP server never
holds up the response. `sendMail` swallows its own failures and logs them: an
order that is placed stays placed, and a status that is saved stays saved, even
if no email goes out.

| When | To | Subject |
| ---- | -- | ------- |
| Order placed | customer | `Order SS-1042 confirmed` |
| Order placed | `OWNER_EMAIL` | `New order SS-1042 — Rs 33,597 — Lahore` |
| Status → pending | customer | `Order SS-1042 is being prepared` |
| Status → shipped | customer | `Order SS-1042 is on the way` |
| Status → delivered | customer | `Order SS-1042 delivered` |
| Status → cancelled | customer | `Order SS-1042 has been cancelled` |

The owner is not emailed about status changes — they are the one making them.

**Re-selecting the status an order already has sends nothing.** Writing the same
value again would be harmless; emailing the customer again would not be.
`changeOrderStatus` reports this back as `emailQueued: false`, which the API
returns as `customerEmailed` and the admin toast words as "Order was already
shipped."

Every template ships an HTML and a plain-text part, and customer-supplied values
— name, address, notes — are HTML-escaped before going into the markup.

Preview all six without sending anything:

```bash
npm run email:preview          # writes email-preview-*.html
npm run email:test -- you@example.com   # checks SMTP, then sends
```

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

- [ ] The eight bags in `src/lib/db/seed-products.ts` are placeholders —
      invented names, prices and descriptions. Replace them with the real stock
      from the admin panel.
- [x] Ratings. Seeded products carry `rating: 0, reviewCount: 0`, and the
      `Rating` component renders nothing when `reviewCount` is 0, so no made-up
      score is ever shown. Real ratings need a reviews feature, which does not
      exist yet.
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
- Customer-facing order history.
- Reviews, so `rating` and `reviewCount` stay at 0 and the stars stay hidden.
- Reserving stock and writing an order are not one transaction — see
  [Stock](#stock).

## Catalogue shape

One category today — `ladies-bags`. Nothing in the app hardcodes that: categories
are read from the database, so adding a second one (from `seed-products.ts`, or
straight into the `categories` collection) makes the pieces that only make sense
with a choice appear on their own:

- the homepage's "Shop by category" section, hidden while there is one category
- the shop page's category pills, hidden for the same reason
- `ProductImage` picks its tile artwork by category slug, with a neutral
  fallback for any slug it does not know

Replacing the catalogue wholesale means clearing `products` and `categories`
first, then `npm run seed` — the seed upserts by id, so old rows outside the new
set would otherwise be left behind in categories that no longer exist. Orders and
users are untouched by this: each order stores its own copy of the item names and
prices, so past orders keep reading correctly even after the catalogue changes.
