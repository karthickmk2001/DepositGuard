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
| Who holds the deposit | Landlord | PDA |
| Move-in evidence | Phone photos, easily faked | SHA-256 hash on-chain |
| Dispute resolution | RTB: 6–12 months | Arbitration: days |
| Works for international tenants | No | Yes — just a wallet |

---

## Repo structure

```
.
├── depositguard-app/        # Next.js 16 frontend (deployed on Vercel)
├── depositguard-program/    # DepositGuard program (Anchor / Rust)
├── automation/               # H9IAPA CA: RPA onboarding bot + AI dispute agent (photo-vision)
├── bpmn/                     # H9IAPA CA: As-Is / To-Be diagrams (draw.io) for automation/
├── h9iapa-ca/                # H9IAPA CA: alternate solution set (text-based agent, full report)
└── DepositGuard PRD - AI-ML Addendum.md
```

`automation/`+`bpmn/` and `h9iapa-ca/` are two independent implementations of the
same H9IAPA coursework, kept side by side — see each folder's own README.

## Tech stack

- **Frontend:** Next.js 16, React 19, Tailwind v4, TypeScript
- **Wallets:** `@solana/wallet-adapter-react` (Phantom, Solflare, etc.)
- **On-chain:** DepositGuard program (Rust), Anchor framework
- **Off-chain storage:** Supabase (photo blobs, tenancy metadata)
- **Hosting:** Vercel

## Local development

```bash
cd depositguard-app
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev
```

Then open `http://localhost:3000` and connect a Phantom wallet on Devnet.

## Required environment variables

| Var | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only API routes |
| `OPENAI_API_KEY` | Server-only, powers `/fair-split` |

## Status

Runs on Solana Devnet — not production-ready for real deposits.
