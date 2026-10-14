# Solei

Web platform for Solei — a destination-led fragrance house from Abu Dhabi. _Made to remain._

Storefront, admin & event POS, private event booking and the Solei Passport loyalty programme.

## Setup

Requirements: Node 22+, pnpm, Docker (for local Supabase).

```bash
pnpm install
pnpm db:start                    # local Supabase; prints URL + keys
cp .env.example .env.local       # fill Supabase keys from `pnpm exec supabase status`
pnpm dev                         # http://localhost:3000
```

| Command         | What it does                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| `pnpm check`    | lint + typecheck + unit tests                                                |
| `pnpm build`    | production build                                                             |
| `pnpm e2e`      | Playwright (iPhone, iPad, desktop) — run `pnpm exec playwright install` once |
| `pnpm db:reset` | re-run migrations + seed                                                     |
| `pnpm db:types` | regenerate Supabase TS types                                                 |

Project conventions: [`CLAUDE.md`](CLAUDE.md). Progress: [`docs/PROGRESS.md`](docs/PROGRESS.md).
Deployment (Vercel + Supabase cloud) is set up later.
