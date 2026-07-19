# DepositGuard — frontend

Next.js 16 (App Router) frontend for DepositGuard. See the [repo root README](../README.md) for the full project overview (problem, solution, tech stack).

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in real Supabase + OpenAI values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect a Phantom wallet on Devnet.

## Key routes

| Route | Purpose |
|---|---|
| `/` | Marketing homepage |
| `/create` | Landlord creates a tenancy escrow |
| `/dashboard` | Wallet-scoped list of tenancies, table-style status view |
| `/deposit/[id]` | Tenant pays deposit into escrow |
| `/resolve/[id]` | Move-out: propose/agree deposit split |
| `/arbitrate/[id]` | Arbitrator reviews a disputed split |
| `/inspect/[id]` | Independent inspector signs the move-in report |
| `/fair-split` | Standalone AI demo — suggests a wear-and-tear-vs-damage deposit split from text descriptions (OpenAI, server-side via `/api/dispute-assessment`) |

## Checks

```bash
npx tsc --noEmit -p .   # typecheck
npx eslint .            # lint
npx next build          # production build
```

All three currently pass clean.

## Deploy

Linked to Vercel (`.vercel/project.json`). `npx vercel --prod` deploys to the production alias. Required env vars must also be set in the Vercel project (`npx vercel env add <NAME> production`), separately from local `.env.local`.
