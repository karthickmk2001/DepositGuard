# DepositGuard

**Decentralised rent deposit escrow for Ireland **

Live demo: **[depositguard-app.vercel.app](https://depositguard-app.vercel.app)** 

---

## The problem

Ireland has **no deposit protection scheme**. Landlords hold an estimated €500M+ of tenant money each year with no neutral custodian. When disputes happen, the RTB takes **6–12 months** to resolve them.

International tenants get hit hardest — many have already left the country before any decision is made.

## The solution

DepositGuard locks rent deposits in a **Program Derived Address (PDA)**. Neither side can withdraw unilaterally:

1. **Landlord creates the escrow** — sets the deposit amount, uploads move-in photos. A SHA-256 hash of every photo is stored on-chain.
2. **Inspector signs the condition report** — an independent inspector signs the baseline on-chain.
3. **Tenant pays into the PDA** — funds go to a program-controlled address, not the landlord's wallet.
4. **Move-out** — both parties sign off on the split (escrow releases in seconds), or an arbitrator decides based on the on-chain evidence.

| | Today | DepositGuard |
|---|---|---|
| Who holds the deposit | Landlord | On-chain PDA |
| Move-in evidence | Phone photos, easily faked | SHA-256 hash on-chain |
| Dispute resolution | RTB: 6–12 months | Arbitration: days |
| Works for international tenants | No | Yes — just a wallet |

### Fair Split Assistant (`/fair-split`)

A standalone AI tool: describe a property's move-in condition and what
changed at move-out, and it returns a wear-and-tear-vs-damage
classification per item plus a suggested deposit split with reasoning
(OpenAI, called server-side via `/api/dispute-assessment` — the key is
never exposed to the browser). Advisory only; doesn't touch the on-chain
escrow.

---

## Repo structure

```
.
├── depositguard-app/        # Next.js 16 frontend (deployed on Vercel)
├── depositguard-program/    # DepositGuard program (Anchor / Rust)
├── automation/               # H9IAPA CA: RPA onboarding bot + AI dispute agent (photo-vision)
├── bpmn/                     # H9IAPA CA: As-Is / To-Be diagrams (draw.io) for automation/
└── h9iapa-ca/                # H9IAPA CA: alternate solution set (text-based agent, full report)
```

`automation/`+`bpmn/` and `h9iapa-ca/` are two independent implementations of the
same H9IAPA coursework, kept side by side — see each folder's own README.

## Tech stack

- **Frontend:** Next.js 16, React 19, Tailwind v4, TypeScript
- **Wallets:** `@solana/wallet-adapter-react` (Phantom, Solflare, etc.)
- **On-chain:** DepositGuard program (Rust), Anchor framework
- **Off-chain storage:** Supabase (photo blobs, tenancy metadata)
- **AI:** OpenAI API (Fair Split Assistant, server-side only)
- **Hosting:** Vercel

## How to run this project

### Prerequisites

- **Node.js 20+** and npm
- A **Solana wallet browser extension** — [Phantom](https://phantom.app), set to **Devnet** — to connect on the site
- A **Supabase** project ([supabase.com](https://supabase.com), free tier is fine) — off-chain storage for photos/tenancy metadata
- An **OpenAI API key** ([platform.openai.com](https://platform.openai.com)) — only needed if you want the Fair Split Assistant (`/fair-split`) to work; the rest of the site runs fine without it

### 1. Clone and install

```bash
git clone https://github.com/karthickmk2001/DepositGuard.git
cd DepositGuard/depositguard-app
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local` with real values:

| Var | Where it's used | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (with RLS) | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only API routes | Supabase Project Settings → API |
| `OPENAI_API_KEY` | Server-only, powers `/fair-split` | platform.openai.com |

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect Phantom, switch it to **Devnet**, and get free Devnet SOL from the [Solana faucet](https://faucet.solana.com) if your wallet is empty.

### 4. Try the flow

- **As a landlord:** `/create` → set a deposit amount → upload move-in photos → get a shareable link.
- **As a tenant:** open the link at `/deposit/[id]` → pay the deposit into escrow.
- **At move-out:** `/resolve/[id]` → landlord proposes a split → tenant agrees (releases instantly) or disputes (goes to `/arbitrate/[id]`).
- **Try the AI tool standalone:** `/fair-split` — no wallet needed, just describe a move-in/move-out scenario.

### 5. Before committing changes

```bash
npx tsc --noEmit -p .   # typecheck
npx eslint .            # lint
npx next build          # production build
```

### 6. Deploy

The project is linked to Vercel (`depositguard-app/.vercel/project.json`).

```bash
npx vercel --prod
```

Environment variables must also be set on Vercel (separately from local `.env.local`):

```bash
npx vercel env add OPENAI_API_KEY production
```

### Running the H9IAPA CA automation solutions

Two independent coursework solutions live alongside the site — see
`automation/README.md` and `h9iapa-ca/README.md` for their own run
instructions (both are plain Python, not part of the Next.js app).

## Status

Runs on Solana Devnet — not production-ready for real deposits.
