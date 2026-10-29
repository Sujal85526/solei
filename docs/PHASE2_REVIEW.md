# Phase 2 — requirements review (with the owner, 2026-10-29)

The owner's Phase 2 requirements, one section each, checked against the code. Each line says what is
built, where (`main` = live, `phase-2` = branch, not merged) and what is missing. Nothing here is
decided yet. The owner is still sharing requirements, so this is not the full list.

Legend: ✅ built · ⚠️ partly / differs · ❌ not built

**2026-10-30:** `main` was merged into `phase-2` (sync, commit db93682), so `phase-2` now has every live change; `main` is unchanged.

---

## 1. Giveaways & customised orders 🎁 (weddings, graduations, Ramadan, Eid, other occasions)

Built on `phase-2` only (`20261024000010_giveaways.sql`, Admin → Products → a product → Customisation,
`options-editor.tsx`). Any product can have choices; there is no separate "giveaway" type (P2-18).

| Requirement | Status | Notes |
|---|---|---|
| Dedicated section for giveaways / occasion gifts | ❌ | No giveaways page, no occasion landing pages. A giveaway is a normal shop product with choices. |
| Choose the product (perfume or all-over spray) | ⚠️ | No product-type step. You set it up by hand as separate products or as a text choice. |
| Choose the scent | ⚠️ | Only as a hand-made "pick one" choice. Not linked to the real scents/variants or their stock. |
| Choose the quantity | ✅ | Minimum per order (e.g. 20); the quantity starts at that minimum. |
| Packaging & design options **with photos** | ⚠️ | Options exist (pick one / pick any, price change per piece). **No photos on options.** |
| Special requests / personalisation | ✅ | Text choice, e.g. names on a tag, up to 200 characters. |
| Total price incl. customisation charges | ✅ | "AED x each · AED y"; the DB works out the price (`line_unit_price_fils`). |
| Order and pay online | ✅ | Choices go through the bag, checkout, discount codes, the order snapshot (`order_lines.options`), the order pages and emails. |
| Flexible: add designs, products, options later | ✅ | All admin-editable; old orders keep their snapshot. |

Also:
- ⚠️ Not at the till (POS) or on staff manual orders. Website only.
- ⚠️ Only checked locally. No customisable product exists on the live DB (`PHASE2_MERGE.md` §4: the live
  checkout can't send choices until the merge).

## 2. Plan Your Event — perfume service 🌸

Built in **Phase 1** (`20261014200001_bookings.sql`, milestone 14), so it's on `main` as well as
`phase-2`. Hidden on production behind `NEXT_PUBLIC_FEATURE_BOOKINGS` (live site shows "Coming soon");
on for the phase-2 preview. Page `/events`, wizard `booking-wizard.tsx` + `wizard-steps.tsx`, admin
Admin → Bookings (+ Settings for event types, packages, booths, flowers).

| Requirement | Status | Notes |
|---|---|---|
| Clearly visible on the **homepage** (not a menu or slideshow) | ❌ | Homepage has no events section. Only the `/events` link in the menu. |
| Step 1 — event type (Wedding, Engagement, Graduation, Ramadan Gathering, Eid Celebration, Family Gathering, Corporate Event, Other) | ✅ | Admin-editable list. Live DB has: Wedding, Engagement, Birthday, Graduation, Ramadan, Eid, Family gathering, Corporate, Other. The names need adjusting (admin change). |
| Step 2 — date, location, guests, name + mobile, special requirements | ⚠️ | Date, start/end time, location, emirate and guests are in step 2. **Name, mobile, email and special requests are on the last step**, not step 2. |
| Step 3 — packages: view, compare, select | ✅ | Name, price, inclusions, photos; compare view; "Not sure yet" option. 3 placeholder packages on the live DB. |
| Step 4 — booth design with photos; add more later | ✅ | `booth_designs` with photos, admin-editable. 3 on the live DB. |
| Step 5 — flowers: "No flowers" (no charge) or "Add flowers" + colour, charge added automatically | ✅ | `flower_options`: colour + surcharge on top of `settings.booking_flower_base_fils` (default AED 800). 5 colours on the live DB. |
| Step 6 — summary: selections, details, package price, extras, total | ✅ | Server-side estimate (`previewEstimateAction`). |
| Submit for confirmation; collect payment / deposit online | ✅ | Two stages: request → staff review → quote (versioned) → customer accepts from a link → deposit paid online → confirmed + calendar event. No payment at the moment of booking. |
| Flexible: packages and prices editable later | ✅ | All admin-editable. |

Differences from the owner's flow:
- ⚠️ The wizard has **9 steps**, not 6: event type → details → **services** → package → booth → flowers →
  **products of interest** → contact → summary. "Services" and "Products" were not in the owner's list.
- ⚠️ Feature switched off on production (env var).

## 3. Admin dashboard — sales & payment management 📊

Built in **Phase 1**, **live on `main`** (one sales ledger: `20261014000008_orders_payments.sql`).

| Requirement | Status | Notes |
|---|---|---|
| Centralised sales tracking (website, WhatsApp, events, direct) | ✅ | Every sale is an order. Channels: website, pos (events/exhibitions/family gatherings at the till), whatsapp, direct, payment_link, booking. Admin → Orders, Dashboard, Reports. |
| Manual order entry: product, scent, quantity, price, customer | ✅ | Admin → Orders → New order (`manual-order-form.tsx`): WhatsApp/Direct, products (scent = variant), quantity, price change with a reason, customer picker / new customer, record a payment now. |
| Payment status: Paid / Partially paid / Pending | ✅ | Calculated from payments (`order_payment_summary`), never typed in. Filter on Orders. |
| Payment links from the dashboard, shared on WhatsApp | ✅ | Order → Payment link panel: link for the outstanding (or part) amount, WhatsApp share button, reminders. N-Genius on main. |
| Outstanding payments: customers + amounts | ✅ | Admin → Orders → Outstanding: by customer, oldest first, overdue count, reminder button. Also a KPI on the dashboard. |
| Automatic sales records: date, amount, products, payment method | ✅ | Order lines + payments rows (cash, card terminal, soft POS, bank transfer, payment link, online card, Apple Pay, other); activity/audit log. |
| Customer history (online + manual) | ✅ | Admin → Customers → a customer: all their orders from every channel. |
| Mobile / iPad friendly | ✅ | Admin + POS built for phone/iPad; e2e runs on iPhone 13, iPad and desktop. |
| Simple enough to run alone | ✅ | In-app Help pages (Settings → Help). |

Gaps tied to Phase 2:
- ⚠️ Manual orders and POS can't take giveaway choices (see §1).
- ⚠️ Phase 2 adds to this area (gift cards at checkout and the till, points, promotions report), only
  after the merge.

## 4. Event sales tracking & management 📊 (exhibitions, pop-ups, other events)

Built in **Phase 1**, **live on `main`**. Admin → Calendar (events), Admin → POS (`?event=`), Admin →
Reports → Events (`reports/events/[id]`, `reports/events/compare`).

| Requirement | Status | Notes |
|---|---|---|
| Create an event: name, date, location | ✅ | Admin → Calendar → New: type (exhibition, pop-up, private booking, other), dates, location, staff, documents, expenses, look. |
| Record sales during the event: product, scent, quantity, payment method | ✅ | POS: pick the event, tap product tiles (scent = variant), − / + strip, Charge → cash, card machine, soft POS, bank transfer. |
| Total sales worked out automatically | ✅ | Each sale is an order tagged with the event; the report adds them up. |
| Best-selling perfumes / sprays per event | ✅ | Event report → "Best sellers" (by units), plus units by product, category split and units by destination. |
| Event inventory: brought / sold / left | ✅ | Event → Stock: move stock to the event's location; report "Stock" shows allocated → sold → returned to main stock. |
| Payment breakdown (cash / card / bank transfer) | ✅ | Event report → "Payment methods" chart + table. |
| End-of-event report: revenue, items sold, best scents, remaining stock | ✅ | Event report: revenue, units, average order, net of VAT, COGS, gross/net profit, expenses, revenue by day, best sellers, stock. Excel export on `main`; **PDF download on `phase-2` only**. |
| Compare events | ✅ | Reports → Events → Compare: revenue, revenue/day, orders, units, units/day, COGS, expenses, profit, margins. |
| Simple POS on iPad / phone, a few taps per sale | ✅ | Tap tiles → Charge → method → done. Order strip with − / + to fix mis-taps (on both branches). |

Gaps:
- ⚠️ PDF event report is only on `phase-2` (Excel works today).
- ⚠️ POS can't take giveaway choices (see §1). Gift cards at the till come with `phase-2`.

## 5. Inventory & stock management 📦

Built in **Phase 1**, **live on `main`**. Admin → Inventory (+ Locations, Low stock, Movements, a variant's
page). Stock = sum of `stock_movements` (never a typed number), per variant per location.

| Requirement | Status | Notes |
|---|---|---|
| Centralised inventory: all products + scents in one place | ✅ | Admin → Inventory: every variant (product + scent/size) with totals per location. |
| Automatic decrease on website / manual / POS sales | ✅ | Website (on paid), manual orders, POS all write `stock_movements`. The 100 − 20 − 30 − 10 = 40 example works. |
| Stock per product & scent | ✅ | Per variant, per location. |
| Event stock allocation (what I take to the event) | ✅ | Transfer stock to the event's location (Event → Stock / Inventory → transfer). |
| Remaining event stock back into the main inventory | ✅ | Event report "Stock": allocated → sold → returned to main stock (transfer back). |
| Low-stock alerts | ✅ | Per-variant threshold (or default 5, Settings); "Low stock" list + dashboard card; owner email `owner_low_stock` when a product drops to its alert level. |
| Stock adjustments: add new stock, damaged, corrections | ✅ | Receive, Damage, Correction +/− (reason required); all in Movements with who/when. |
| Inventory reports: fast vs slow movers | ✅ `p2/reports` | Reports → Business (`p2/reports`): fastest / slowest movers on all channels, units/day, days of stock, last sale, "no sale in 30/60/90/180 days", stock value. |
| Simple from phone / iPad | ✅ | Admin responsive; e2e on iPhone/iPad. |

Gaps:
- ✅ Fast/slow movers: Reports → Business → Stock (`p2/reports`).
- ⚠️ Low-stock alert is email only. WhatsApp to the owner isn't built (WhatsApp provider is a stand-in on `phase-2`).

## 6. Event calendar & participation management 📅

Built in **Phase 1**, **live on `main`** (`20261014000006_events_core.sql`, `20261014100001_events_calendar.sql`).
Admin → Calendar (month / week / list views), an event's page, Reports → Events.

| Requirement | Status | Notes |
|---|---|---|
| 1. Calendar: upcoming, ongoing, completed events | ✅ | Month, week and list views; each card shows its status against today. |
| 2. Details: name, location, organiser, date, timing | ✅ | Name, type, location + emirate, organiser name/contact/phone/email, start–end dates, opening hours per day (`daily_hours`), booth details, notes, documents. |
| 3. Participation fee | ✅ | `participation_fee_fils` + fee status (unpaid / partially paid / paid / waived / not applicable). |
| 4. Expenses: staff, transport, setup… | ✅ | Event → Expenses: staff, transport, setup, accommodation, marketing, other (owner/financial permission only). |
| 5. Status: upcoming, confirmed, completed, cancelled | ✅ | Statuses are potential (= "upcoming / not yet confirmed"), confirmed, completed, cancelled. ⚠️ The label says "Potential", not "Upcoming"; rename if wanted. |
| 6. Event revenue linked to the calendar entry | ✅ | POS sales are tagged with the event; the event page links to its report. |
| 7. Profitability: revenue, expenses, estimated profit | ✅ | Event report: revenue, COGS, gross profit, expenses + fee, net profit, margins; Compare across events. |
| 8. Monthly overview, avoid overlapping bookings | ✅ | Month view; **overlap warning** when an event's dates clash with another (warns, doesn't block). |
| Connected to sales + inventory, one dashboard | ✅ | Event ↔ POS sales ↔ event stock (allocated/sold/returned) ↔ report; dashboard shows upcoming events + booking requests. |

Gaps:
- ⚠️ No "Wedding" event type in the calendar: types are exhibition, pop-up, private booking, other. Weddings come in
  through Plan Your Event bookings and become a "private booking" calendar entry on confirmation. Add types if wanted.
- ⚠️ Status label "Potential" vs the owner's "Upcoming" (wording only).

## 7. Customer management & database (CRM) 👥

Core CRM built in **Phase 1** (milestone 10), **live on `main`**: Admin → Customers, `customer_summary` view.
Segments, campaigns and VIP tiers are on **`phase-2`** (`20261024000007`, `…009`).

| Requirement | Status | Notes |
|---|---|---|
| 1. Profiles saved automatically: name, mobile, email, purchase history | ✅ `main` | From website sign-up/checkout, POS, manual orders, bookings, newsletter, CSV import. Source recorded. |
| 2. One customer database | ✅ `main` | Admin → Customers: filters (consent, source, emirate, has orders), sort (recent, spent, name, newest), CSV export. |
| 3. Purchase history: orders, products, amounts, dates | ✅ `main` | Customer page: every order from every channel; order count + total spent (money actually received, net of refunds). |
| 4. VIP: regular + highest-spending customers | ⚠️ | `main`: sort by total spent / orders only. `phase-2`: VIP tiers by spend (points & tiers, **off by default**) + segments by spend/orders. No "VIP" badge on `main`. |
| 5. Segmentation: new, returning, VIP, inactive | ⚠️ `phase-2` | Admin → Campaigns → Segments: saved rules (min/max spent, min orders, bought in last X days, **not bought in X days** = inactive, destinations, Passport, emirate, consent). These are **custom filters**, not fixed new/returning/VIP/inactive labels on each profile. |
| 6. Feedback: reviews, complaints, suggestions | ⚠️ | Product reviews ✅ (`main`, owner approves). **Complaints / suggestions: not built.** Only a free-text "notes" field on the customer. |
| 7. Marketing: promos, new products, offers via WhatsApp or email, only to opted-in customers | ⚠️ `phase-2` | Email campaigns ✅: segment → campaign, only to customers with email consent, unsubscribe link in every email. **WhatsApp campaigns: not built.** Consent is stored per channel (email/WhatsApp) since Phase 1. |
| 8. Analytics: new vs returning customers, purchasing trends | ✅ `p2/reports` | Reports → Business (`p2/reports`) → Customers: new / returning, repeat rate, top spenders, new vs returning over time. |
| 9. Search by name or mobile | ✅ `main` | Matches local formats ("050 123 4567" finds +971…), name or email. |
| 10. Data privacy: secure, authorised users only | ✅ `main` | RLS on every table, role permissions (customers.view etc.), audit log, consent + unsubscribe timestamps. |
| ★ Connected to sales: history updates automatically | ✅ `main` | Any order linked to the customer shows up immediately (attach a customer to an order from the admin too). |

Gaps:
- ⚠️ VIP badge / automatic new · returning · VIP · inactive labels on profiles and in the customer list.
- ❌ Complaints & suggestions log.
- ❌ WhatsApp marketing messages.
- ✅ Customer analytics: Reports → Business → Customers (`p2/reports`).

## 8. Reports, analytics & business performance dashboard 📈

What exists (`main` unless noted): the **Dashboard** (`dashboard_summary`, Phase 1 milestone), **event reports**
+ compare, **exports** (orders, payments, customers, stock; Excel/CSV with a date range), the **orders list**
filters (status, payment, channel, event, from–to), and on `phase-2` the **promotions report** + **PDF event report**.
There is **no business-wide reports page**: Admin → Reports today = events (+ promotions on `phase-2`).

| Requirement | Status | Notes |
|---|---|---|
| 1. Sales overview by day, week, month, year | ✅ `p2/reports` | Reports → Business: any range, chart by day/week/month vs the previous period. Before: Dashboard: Today / This week / This month revenue + orders, each vs the same days of the previous period. **No year, no chosen-period view, no chart over time.** |
| 2. Revenue by online, POS, Soft POS, payment links | ✅ `p2/reports` | Reports → Business: revenue by channel + by payment method (Soft POS, cash, card…) for any range. Before: Dashboard "Revenue by channel" (website, POS, WhatsApp, direct, payment link, booking), **this month only**. Soft POS is a payment *method*: split shown per event, not business-wide. |
| 3. Product performance: perfumes, sprays, dukhoon, other | ✅ `p2/reports` | Reports → Business: categories, best sellers, every product/size, all channels. Before: Dashboard "Top products" (this month, units); per-event best sellers + category split. **No all-channel product/category report for a chosen period.** |
| 4. Event performance: compare exhibitions, weddings, events | ✅ | Reports → Events → Compare (revenue, units, profit, margins). Weddings from bookings show as deposits/orders, not as POS events. |
| 5. P&L: revenue, expenses, product cost, net profit | ✅ `p2/reports` | Reports → Business → P&L + Reports → Expenses (rent, salaries…). Before: **Per event** ✅ (revenue, COGS from `cost_fils`, expenses + fee, net profit). **No business-wide P&L** (and no place for non-event expenses like rent, marketing, salaries). |
| 6. Inventory reports: stock levels, low stock, inventory value | ✅ `p2/reports` | Stock value on Inventory + in the business report. Before: Stock levels ✅, low stock ✅, stock export ✅. **Inventory value (units × cost) not shown.** |
| 7. Customer analytics: new, returning, VIP, trends | ✅ `p2/reports` | Reports → Business → Customers. Before: Same gap as §7 (#17). |
| 8. Sales trends charts: growth, seasonal demand | ✅ `p2/reports` | Sales over time vs previous period + year month by month vs last year. Before: Only "revenue by day" inside an event report. No month-by-month / year chart. |
| 9. Payment reports by method: cash, card, Soft POS, links | ✅ `p2/reports` | Reports → Business → Payment methods. Before: Per event ✅ (chart + table). Business-wide: **Payments export (Excel/CSV) only**, no on-screen report. |
| 10. Order reports: total, completed, cancelled, average order value | ✅ `p2/reports` | Reports → Business → Orders. Before: Orders list filters + "Today's orders"; average order per event. **No order report** with completed / cancelled counts and AOV for a period. |
| 11. Custom date filters | ✅ `p2/reports` | Presets + custom range on Reports → Business. Before: Exports, orders list, promotions report have from–to; event report by day. **No general report with a date picker.** |
| 12. Export Excel + PDF | ✅ `p2/reports` | PDF beside every Excel: business report, exports, promotions, events. Before: Excel/CSV ✅ (exports + event reports). **PDF only for event reports, on `phase-2`.** |
| 13. Dashboard summary: revenue, orders, estimated profit, best sellers, upcoming events | ✅ `p2/reports` | "This month · est. profit" KPI (financial only). Before: Revenue ✅, orders ✅, top products ✅, upcoming events ✅, outstanding, low stock, booking requests. **Estimated profit not on the dashboard.** |
| 14. Compare months, events, categories | ✅ `p2/reports` | Months (year vs last year), categories (business report), events (compare). Before: Events ✅. Months: only "vs the same days last period" on the dashboard. Categories: only inside one event. |
| ★ Connected to sales, inventory, CRM, events; no double entry | ✅ | Everything reads the same orders / payments / stock movements / customers / events. Nothing is typed twice. |
| ★ Clean dashboard with charts | ⚠️ | Charts exist (channel bars, revenue by day, payment methods, category split), but only for this month / per event. |

Gaps, as one build item: a **business Reports page** with a date range (presets: day / week / month / year /
custom): sales over time chart, revenue by channel and by payment method, product + category performance,
orders (total / completed / cancelled / AOV), business-wide P&L (needs a general-expenses list), inventory value,
customer analytics, month-vs-month and category comparison, Excel + PDF export. Plus estimated profit on the dashboard.

## 9. Staff management, user access & permissions 👤

Core built in **Phase 1**, **live on `main`** (`20261014000002_staff_permissions.sql`): Admin → Staff, Staff → Roles,
Activity. Attendance is on **`phase-2`** (`20261024000011_operations.sql`, Admin → Attendance).
Roles on the live DB: Owner (all, 33), Manager (32), Sales staff (13).

| Requirement | Status | Notes |
|---|---|---|
| 1. Staff profiles: name, position, contact, employment status | ✅ `main` | Full name, email, phone, position, status (full time / part time / freelance / event only / former), role. |
| 2. Own login per employee | ✅ `main` | Invite by email; they set their own password. Optional 2-step login (MFA) per role. |
| 3. Role-based access | ✅ `main` | Staff → Roles: tick permissions per role; add new roles. Checked in the database (RLS), not only the screen. |
| 4. Owner: full access | ✅ `main` | Owner always has every permission (can't be removed). |
| 5. Sales staff: sales, availability, customer orders only | ✅ `main` | Sales staff role: POS, create/view orders, record payments, payment links, view stock, customers, bookings/events view. No financials, no settings, no staff. |
| 6. Assign staff to exhibitions, weddings, events | ✅ `main` | Event → Staff, with a role (e.g. "Booth lead"). Weddings = booking → calendar entry, same assignment. |
| 7. Attendance: attendance, working hours, **assigned shifts** | ⚠️ `phase-2` | Clock in / out on the dashboard (optionally at an event), hours per person for a period; staff with staff.manage see and edit everyone's. **Planned shifts / rota: not built.** |
| 8. Sales per employee | ❌ | Orders store who made them (`orders.staff_id`), but **no report or filter by staff member**. |
| 9. Activity tracking: sales, stock changes, refunds, cancellations | ✅ `main` | `audit_log` on every important table + Admin → Activity (who, what, when). |
| 10. Hide profits, expenses, financial reports from unauthorised staff | ✅ `main` | `reports.financial.view`: without it, COGS, profit, margins and expenses are hidden in reports and the database. |
| 11. Staff performance report: attendance, events, individual sales | ❌ | Only attendance hour totals (on `phase-2`). No combined report per person. |
| 12. Activate, deactivate, modify accounts | ✅ `main` | Staff page: edit, change role, deactivate / reactivate (blocks sign-in at once). |
| ★ Simple for non-technical staff | ✅ | POS made for a few taps; in-app Help pages. |
| ★ Owner controls permissions; all activity traceable | ✅ `main` | Role editor + Activity log. |

Gaps:
- ❌ Sales per staff member (report / filter).
- ❌ Staff performance report (attendance + events worked + sales per person).
- ❌ Planned shifts / rota (only actual clock-in hours exist).
- ⚠️ Attendance itself is on `phase-2`, so it comes with the merge.

## 10. Promotions, discount codes, loyalty program & gift cards 🏷️

Mostly on **`phase-2`**: promotions (`20261024000001`/`…002`, Admin → Promotions), gift cards (`…003`–`…005`,
Admin → Gift cards), points & VIP tiers & birthday (`…008`/`…009`, Admin → Loyalty → Points & tiers, **off by
default**). `main` has basic coupons (Phase 1) and the Solei Passport stamp card.

| Requirement | Status | Notes |
|---|---|---|
| 1. Discount codes: % or fixed AED | ✅ | `main` already; `phase-2` adds free-delivery codes. |
| 2. Seasonal promotions (Ramadan, Eid, National Day, Valentine's…) | ✅ `phase-2` | A code with start/end dates. No special "occasion" type; you just name the code. |
| 3. Product promotions: selected products / categories (collections) | ✅ `phase-2` | Scope by products and/or categories. ⚠️ Codes only. **No automatic sale price** (e.g. "Ramadan: 15% off all sprays" shown on the shop without a code). |
| 4. Bundle offers (perfume + spray at a promo price) | ❌ | Not built (noted in DECISIONS as later). |
| 5. Buy X get Y (Buy 2 get 1 free) | ❌ | Not built. |
| 6. Points for purchases, redeem for discounts **or products** | ⚠️ `phase-2` | Earn per AED paid, redeem at website checkout as money off. **Redeem for products: not built** (the Passport stamp card on `main` gives rewards separately). **Off by default.** Not at the POS. |
| 7. VIP rewards: exclusive discounts, early access, special promotions | ⚠️ `phase-2` | VIP tiers by 12-month spend: points multiplier + a "perks" text. **No VIP-only discount codes, no early access to new collections.** Email campaigns to a VIP segment work (§7). |
| 8. Digital gift cards in AED 100 / 200 / 500… | ✅ `phase-2` | Amounts set by the owner ("100, 200, 500"); the code is emailed to the buyer or the person they name. |
| 9. Redeem online, balance tracked automatically | ✅ `phase-2` | At checkout (and at the till if allowed). Balance = ledger; refunds go back to the card. |
| 10. Birthday offers to opted-in customers | ⚠️ `phase-2` | Birthday **bonus points** + email, once a year (needs points switched on + a scheduler). **Not a birthday discount code.** |
| 11. Scheduling: start / expiry dates | ✅ `phase-2` | On codes. (Campaigns send when you press send, not scheduled.) |
| 12. Restrictions: products, minimum spend, use limits, combining | ⚠️ `phase-2` | Products/categories ✅, minimum order ✅, total uses ✅, uses per customer ✅. **Combining: one code per order only** (stacking not built). Gift card + points + one code together does work. |
| 13. Promotional banners on the homepage | ❌ | Homepage hero/slides are in code (`src/content/home.ts`), **not editable from the admin**. No announcement bar. |
| 14. Promotion performance: customers, sales, discount given | ✅ `phase-2` | Reports → Promotions: uses, discount given (goods + delivery), sales per code, for a date range. |
| 15. Event-specific codes (exhibitions, weddings, events) | ⚠️ | You can make a code per event, but **codes work on the website only; the POS can't take a code** and codes aren't linked to an event in reports. |
| ★ All managed from the admin, no developer | ✅ (except banners) | Codes, gift card amounts, points rates, tiers: all admin-editable. |
| ★ Discounts worked out at checkout + in reports | ✅ `phase-2` | Database calculates (`coupon_evaluate`); orders keep `applied_promotions`; promotions report. |

Gaps:
- ❌ Bundle offers. ❌ Buy X get Y.
- ❌ Automatic sale prices (no code needed).
- ❌ Homepage banners / announcement bar editable from the admin.
- ❌ Discount codes at the POS (needed for event codes); link a code to an event.
- ⚠️ Combining several codes (one per order today).
- ⚠️ Points: redeem for products; use at the POS. VIP-only codes + early access. Birthday as a discount code
  instead of points.
- ⚠️ Points & tiers are off; turn on after the merge (`POINTS_SWITCH_LOCKED` stays unset on production).

## 11. Notifications, WhatsApp integration & automated communication 💬

**Email** notifications built in Phase 1, **live on `main`** (Settings → Notifications: editable templates,
on/off per template, Outbox = history). **WhatsApp** order updates on **`phase-2`** with a **stand-in provider**
(`MESSAGING_PROVIDER=log`, messages written to the Outbox, not sent). Live DB templates: 22 customer email,
2 customer WhatsApp, 3 owner email.

| Requirement | Status | Notes |
|---|---|---|
| 1. Order confirmation (number, items, total, payment status) | ✅ email `main` · ⚠️ WhatsApp `phase-2` | `order_confirmation`; WhatsApp `order_confirmation_whatsapp` exists but isn't really sent until the API is connected. |
| 2. Payment received | ✅ email `main` | `payment_received`. |
| 3. Status updates: confirmed, preparing, dispatched, delivered | ✅ email `main` · ⚠️ WhatsApp | Email: preparing, dispatched, delivered. WhatsApp: only confirmation + dispatched (stand-in). |
| 4. Delivery + tracking | ⚠️ `phase-2` | Dispatched email/WhatsApp carry tracking; courier booking + tracking is a **stand-in** (`COURIER_PROVIDER=mock`) until a real courier account. |
| 5. Abandoned cart reminders, with consent | ✅ `phase-2` | Email bag reminders + opt-out. **Needs a scheduler** (`/api/cron/cart-reminders`). Email only. |
| 6. Website ↔ official WhatsApp Business account, customers contact us | ⚠️ `main` | Click-to-chat links (`wa.me`) to the business number in the footer / contact page. No API connection. |
| 7. Automatic replies: availability, prices, delivery, hours | ❌ | Not built. Only the public Help centre (policies, editable). Needs the WhatsApp API + a bot or a provider's auto-reply tool. |
| 8. Promotional messages to opted-in customers | ⚠️ `phase-2` | Email campaigns ✅. WhatsApp ❌ (§7). |
| 9. Event announcements to interested customers | ⚠️ | Can be sent as an email campaign by hand. **No "interested in events" list, no automatic announcement.** |
| 10. Feedback request after delivery | ❌ | Not built (reviews exist, but no automatic "how was it?" message). |
| 11. Owner alert on a new online order | ✅ `main` | `owner_new_order` email (+ `owner_new_booking`). Email only, no WhatsApp/push. |
| 12. Low-stock alerts | ✅ `main` | `owner_low_stock` email (§5). |
| 13. Event + staff schedule reminders | ❌ | Not built. Staff are assigned to events (§6/§9) but get no reminder. |
| 14. Failed payment + retry | ✅ `main` | `payment_failed` email with a link back to pay. |
| 15. Manage WhatsApp + email templates from the admin | ✅ | Edit subject/body with variables, preview, on/off. (WhatsApp templates must **also** be approved by Meta once the API is live; see below.) |
| 16. Communication history | ✅ `main` | Settings → Notifications → Outbox (every email / WhatsApp, status). Booking messages log per booking. |
| 17. Turn notifications on/off | ✅ | Per template; WhatsApp master switch on `phase-2`. |
| 18. Marketing consent + unsubscribe | ✅ | Consent per channel (email / WhatsApp) since Phase 1; unsubscribe link in every campaign + bag reminder (`phase-2`). |

**Official WhatsApp Business API: possible, with this setup** (to confirm with the owner; check current prices before quoting):
- Meta Business account, **business verification** (trade licence etc.), a phone number for the API, display name approval.
  The number can stay on the WhatsApp Business app too ("coexistence"), or move fully to the API.
- Connect either **directly (Meta Cloud API)** (no monthly platform fee, we build sending + inbox) or through a **provider**
  (e.g. 360dialog, Twilio, WATI, Interakt), which adds a monthly fee and/or per-message mark-up but gives a shared inbox and
  auto-reply/chatbot tools.
- **Templates** for business-started messages (order updates, reminders, promotions) must be **approved by Meta**
  (usually minutes to a day). Free-form replies are allowed within 24 h after the customer writes.
- **Charges**: Meta charges per delivered template message, by category (marketing > utility; UAE rates). Replies within
  the customer's 24 h window are free; utility messages inside that window are free. Plus the provider's fee if one is used.
- Code side: the messaging interface already exists (`src/providers/messaging`), so a real provider is one adapter + env vars.

Gaps:
- ❌ Real WhatsApp sending (Business API account + provider adapter); then WhatsApp for every customer message, not only 2.
- ❌ Automatic replies to common questions (WhatsApp bot / provider auto-replies).
- ❌ Feedback request after delivery.
- ❌ Event + staff schedule reminders.
- ❌ Event announcements to an "interested in events" list (automatic).
- ⚠️ WhatsApp promotional messages (§7, #16). ⚠️ Owner alerts on WhatsApp. ⚠️ Real courier tracking (stand-in today).
- ⚠️ Scheduler for cart reminders / birthdays / tracking.

---

## ✅ / ❌ Left to do — running list (all sections so far)

Each item is still to be decided with the owner. Section number in brackets.

**Not built**
1. Dedicated Giveaways / occasions section on the store (§1).
2. Photos on giveaway packaging/design options (§1).
3. Guided giveaway flow: product type (perfume / all-over spray) → scent from the real catalog → packaging (§1).
4. Plan Your Event section on the **homepage**, clearly visible (§2).
5. Fast vs slow-moving inventory report across all channels (§5). ✅ `p2/reports` (Reports → Business / Expenses).
15. Complaints & suggestions log for customers (§7).
16. WhatsApp marketing messages (campaigns are email only) (§7).
17. Customer analytics report: new vs returning customers, purchasing trends (§7, §8.7). ✅ `p2/reports` (Reports → Business / Expenses).
20. Business-wide Reports page with a date range (day / week / month / year / custom) (§8.1, §8.11). ✅ `p2/reports` (Reports → Business / Expenses).
21. Sales trend charts over time: growth, month-by-month, seasonal (§8.8). ✅ `p2/reports` (Reports → Business / Expenses).
22. Revenue by channel + by payment method (incl. Soft POS) for any period, business-wide (§8.2, §8.9). ✅ `p2/reports` (Reports → Business / Expenses).
23. Product & category performance for any period, all channels (perfume / spray / dukhoon…) (§8.3, §8.14). ✅ `p2/reports` (Reports → Business / Expenses).
24. Order report: total, completed, cancelled, average order value (§8.10). ✅ `p2/reports` (Reports → Business / Expenses).
25. Business-wide Profit & Loss + a general (non-event) expenses list (rent, marketing, salaries…) (§8.5). ✅ `p2/reports` (Reports → Business / Expenses).
26. Inventory value (units × cost) (§8.6). ✅ `p2/reports` (Reports → Business / Expenses).
27. Estimated profit on the dashboard (§8.13). ✅ `p2/reports` (Reports → Business / Expenses).
28. Compare months and categories (events compare already exists) (§8.14). ✅ `p2/reports` (Reports → Business / Expenses).
29. PDF export for all reports (PDF exists only for event reports, on `phase-2`) (§8.12). ✅ `p2/reports` (Reports → Business / Expenses).
30. Sales per staff member: report + filter (orders already store `staff_id`) (§9.8).
31. Staff performance report: attendance + events worked + sales per person (§9.11).
32. Planned shifts / rota for staff (§9.7).
34. Bundle offers (e.g. perfume + spray at a set price) (§10.4).
35. Buy X get Y free (§10.5).
36. Automatic sale prices on products / categories without a code (§10.3).
37. Homepage promo banners / announcement bar, editable from the admin (§10.13).
38. Discount codes at the POS + link a code to an event for reports (§10.15).
39. Combine several discounts on one order (stacking rules) (§10.12).
40. Points: redeem for products, and use at the POS (§10.6).
41. VIP-only discount codes + early access to new collections (§10.7).
42. Birthday discount code (today: bonus points) (§10.10).
44. Official WhatsApp Business API: owner sets up Meta account + verification; we add a provider adapter;
    then all customer messages (confirmation, payment, status, delivery, failed payment) on WhatsApp too (§11).
45. Automatic replies to common questions (availability, prices, delivery, hours) (§11.7).
46. Feedback request after delivery (§11.10).
47. Event + staff schedule reminders (§11.13).
48. Event announcements to customers interested in events (§11.9).
49. Owner alerts (new order, low stock) on WhatsApp, not only email (§11.11–12).
50. Real courier account + tracking (stand-in today) (§11.4).
51. Scheduler (Vercel cron or similar) for cart reminders, birthdays, tracking (§11.5).

**Built but differs / partial**
6. Giveaway choices at the POS and on staff manual orders (§1, §3, §4).
7. Giveaways only tested locally; needs a real check after the merge (§1).
8. Booking wizard: 9 steps vs the owner's 6. Move name/mobile/requests into step 2; drop or keep "Services" and
   "Products of interest" (§2).
9. Rename event types to the owner's list (Ramadan Gathering, Eid Celebration…). Admin change, no code (§2).
10. Real packages, prices, booth photos, flower colours. Owner to provide; admin change (§2).
11. Switch Plan Your Event on in production (`NEXT_PUBLIC_FEATURE_BOOKINGS=1`) (§2).
12. PDF event report: on `phase-2` only, comes with the merge (§4).
13. Low-stock alert by WhatsApp (email only today; WhatsApp provider is a stand-in) (§5).
14. Calendar: "Wedding" event type? "Potential" → "Upcoming" label? (§6).
18. Automatic New / Returning / VIP / Inactive labels on customer profiles + list; VIP tiers exist on `phase-2`
    but are off by default (§7).
19. Segments + email campaigns are on `phase-2` only, so they come with the merge (§7).
33. Staff attendance (clock in/out) is on `phase-2` only, so it comes with the merge (§9.7).
43. Promotions (scope, limits, free delivery, report), gift cards, points/tiers/birthday: `phase-2` only, so they
    come with the merge. Points are off; switch on after (§10).

**Done (live on `main`)**: §3 sales & payments dashboard, §4 event sales + POS, §5 inventory (except the report),
§6 event calendar, §7 core CRM (profiles, history, search, privacy), §8 dashboard + event reports + Excel
exports (business-wide reports missing), §9 staff profiles, logins, roles, event assignment, activity log.

---

## Merge check (main ← phase-2), done 2026-10-29 — merge NOT started

- Trial merge (`git merge-tree`, nothing written): **6 conflicting files**: `.env.example`, `docs/DECISIONS.md`,
  `admin/customers/[id]/page.tsx` (1 import), `product-card.tsx`, `checkout-form.tsx` (pay button text),
  `order/[number]/page.tsx` (4 hunks. Main moved it into `(checkout)`, restyled it and changed `AwaitPayment`;
  phase-2 added gift cards and options. The real work is here).
- DB: main's `20261029*` migrations only add the enum value, the zone row and templates. They don't clash
  with phase-2 functions. They're applied on the live DB but not recorded in `schema_migrations`
  (idempotent; or `migration repair`).
- N-Genius charges `outstanding_fils` on both sides → gift card / points part-payments are fine;
  `payment-events.ts` calls the same `onOrderPaid`.
- Regenerate `database.types.ts` from the live DB after the merge.
- Estimate: about half a day (conflicts + checks ~2 h, e2e + preview QA ~2–3 h).
- After the merge: Vercel env `CRON_SECRET`, `CART_LINK_SECRET`; add a scheduler (no crons in `vercel.json`);
  manager permissions; drop `coupons.once_per_customer` (`PHASE2_MERGE.md`).
