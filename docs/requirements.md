# Solei — Requirements (working notes)

Client: Solei — UAE perfume brand (perfumes, all-over sprays, dukhoon). Currency AED.
Sells via website, WhatsApp, exhibitions/pop-ups, private events, direct customers.

## Product split

1. **Event booking platform** — customers book Solei for private events; internal exhibition calendar.
2. **E-commerce** — online shop, giveaways/custom orders, admin, inventory, POS.
3. **Loyalty program** — Solei Passport stamp card (default 12 stamps → free all-over spray; all rules admin-configurable).

## Phase 1 (client-confirmed must-haves)

### A. Customer event booking ("Book Solei for your event")
- Event type (wedding, engagement, birthday, graduation, Ramadan, Eid, family, corporate, other)
- Date, start time, end time; location + emirate; guest count; contact details
- Products of interest (perfume / all-over spray / dukhoon) + quantities
- Service type: perfume display booth, guest giveaways, customized arrangements
- View packages, prices, setup/booth photos; flower decoration option (none / add with color, extra charge)
- Special requests
- Submitted → appears in admin as a **request** (not auto-confirmed)
- Admin: review, communicate with customer, prepare/adjust **quotation**, approve/reject, send payment instructions / payment link (deposit or full)
- Confirmed → automatically on internal calendar
- Packages, booths, add-ons all admin-editable (prices not finalized)

### B. Private event & exhibition calendar (owner + authorized staff only)
- Statuses: potential, confirmed, completed, cancelled; also shows confirmed customer bookings
- Per exhibition: name, organizer details, location, dates, working hours, participation fee + payment status,
  booth details, assigned staff, expenses, notes, documents (uploads)
- Sales performance per exhibition, **per day** (multi-day events):
  units per product/scent, by category, revenue, expenses, COGS, profit
- Stock allocated → sold → returned to main inventory
- Compare exhibitions (sales, profit)
- Event sales via POS linked to central inventory (auto stock decrement)

### C. Other Phase 1 essentials (from earlier discussion)
- Shop: catalog (category → product → scent/size variants), cart, checkout, UAE gateway (card + Apple Pay), full payment before confirm
- Orders: New → Preparing → Dispatched → Delivered; confirmations to customer + owner
- Admin: products/prices, inventory (stock-movement ledger by location), manual orders (WhatsApp/direct), payment links, outstanding payments
- Event POS: few-tap sale, payment method (cash/card/bank transfer/soft POS), mobile/iPad-first
- Customers: basic profiles + unified purchase history
- Staff roles (owner/admin vs sales staff), 2FA for admin, activity log
- Dashboard summary + exports

## Loyalty — Solei Passport (rules must be admin-configurable)
Launch with the rules from company profile p.3, but **no rule is hard-coded** — the owner changes them in
Admin → Loyalty settings, no developer needed.

Default settings at launch (each one editable):
| Setting | Default |
|---|---|
| Stamps per qualifying item | 1 |
| Qualifying categories/products | all products (perfumes, all-over sprays, dukhoon…) |
| Stamps needed for a reward | 12 |
| Reward | 1 free all-over spray of customer's choice (reward = choose from a category / specific products / fixed AED value / % off) |
| Passport issued | automatically after 2 purchases, or on request (manual "issue passport" in admin) |
| Free/reward items earn stamps | no |
| Stamp expiry | none (optional N months) |
| Programme on/off | on |

Behaviour:
- Stamps accumulate across orders (1 + 1 + 2 + 3 + 5 …), online **and** offline: POS/manual sale linked to a
  customer by mobile/email awards stamps automatically; admin can also add/remove stamps manually with a reason.
- Each stamp = a destination sticker (scent bought → that destination's stamp) shown in a digital passport
  (customer page + email/WhatsApp after each purchase: "8/12 — 4 more to your free spray").
- Stamp ledger per customer: earned (order, date, scent), redeemed, reversed on refund, manual adjustments (by whom).
- Rule changes apply going forward; already-earned stamps are kept. Rules are versioned so history stays explainable.
- Built as a general rules engine so Phase 3 (points, VIP tiers, birthday offers) plugs in without a rebuild.

## Phase 2 / 3 (deferred)
- Giveaways customizer, full CRM segmentation & campaigns, advanced promotions (bundles, BOGO, stacking),
  gift cards, abandoned cart, WhatsApp auto-replies, courier API, staff attendance, advanced reports/PDF
- Architecture must allow adding these without a rebuild.

## Open questions for client
- VAT registration / tax invoices; English only or Arabic (RTL)?; delivery zones & fees; refund policy;
  customer accounts vs guest; product cost entry for COGS; offline POS needed?; deposit % for bookings;
  booth availability limits (double-booking).
