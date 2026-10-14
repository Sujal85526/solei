# Solei — project guide

@AGENTS.md

Destination-led fragrance brand (Abu Dhabi). One Next.js app: storefront, admin + event POS, event booking,
Solei Passport loyalty. Full brief: `docs/BUILD_PROMPT.md`; requirements: `docs/requirements.md`;
brand: `docs/brand/brand-guidelines.md`. **Resume work from `docs/PROGRESS.md`.**

## Commands

- `pnpm dev` — app on :3000 · `pnpm db:start` / `db:stop` / `db:reset` — local Supabase (Docker)
- `pnpm check` — lint + typecheck + unit tests · `pnpm build` · `pnpm e2e` (Playwright, mobile/iPad/desktop)
- `pnpm db:types` — regenerate `src/lib/database.types.ts` after a migration
- `pnpm format` before committing (CI runs `format:check`)

## Rules

- Money is integer **fils** (`src/lib/money.ts`); VAT/rates in basis points (500 = 5%). No floats.
- Business dates are **Asia/Dubai** (`src/lib/dates.ts`). Phones are E.164 (`src/lib/phone.ts`).
- Business rules (prices, fees, VAT, loyalty, templates, permissions) live in the DB and are admin-editable —
  never hard-code them in components.
- Layering: UI → server action → `src/modules/<domain>/service.ts` (permission check + zod validation + DB
  write + `audit_log`). Multi-row writes go through Postgres functions (RPC) in a transaction.
- Stock = `sum(stock_movements.qty)`; never a mutable column. Order "paid" only from a verified webhook.
- RLS on every table. `createAdminClient()` bypasses RLS — only after an explicit permission check.
- RTL-ready: use logical Tailwind utilities (`ms-/me-/ps-/pe-/start-/end-`), copy in dictionary files.
- Providers (payment, email, messaging) behind interfaces in `src/providers/`.

## Git

- One branch + one PR per milestone (see `docs/PROGRESS.md`), Conventional Commits.
- PR body: Problem / Work / DB changes / How to test / Screenshots (described, never committed).
- Never merge without the user's explicit OK. No AI attribution in commits, PRs or merge messages.
- After merge: add a line to `docs/CHANGELOG.md`, tick the milestone in `docs/PROGRESS.md`.
