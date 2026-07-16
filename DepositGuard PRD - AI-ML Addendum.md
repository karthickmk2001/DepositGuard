# DepositGuard PRD — AI/ML Integration Addendum

**Version:** 1.1 addendum
**Date:** 2026-04-17
**Status:** Optional feature track — can be toggled on without blocking the core P0 escrow flow.

This addendum supplements the base DepositGuard PRD. The core product (DepositGuard escrow + mutual sign-off + optional inspector + arbitrator fallback) is unchanged. This document describes an **AI/ML layer** that can be added to differentiate the demo and strengthen the hackathon narrative, without rewriting any on-chain logic.

---

## 1. Why add AI/ML

The base product solves the *trust* problem (escrow + evidence hashing). AI/ML additionally solves the *judgement* problem — "is this damage real, is it fair wear-and-tear, and what is a fair split?" — which is exactly where landlord/tenant disputes actually break down in practice.

For the Colosseum Frontier / Superteam Ireland submission, an AI layer:
- Gives the demo video a visibly differentiating moment beyond "we have escrow on DepositGuard".
- Maps directly onto Ireland's RTB dispute criteria (wear-and-tear vs damage, depreciation, documented evidence).
- Is feasible inside the remaining ~3 weeks because it is entirely additive — it runs in API routes and writes back to Supabase/DepositGuard only as advisory output.

---

## 2. Feature set (ranked by demo impact)

### 2.1 AI Damage Detection — **Recommended P1**

**What:** When a landlord uploads move-out photos on `/resolve/[id]`, a vision model compares them to the corresponding move-in photos and produces:
- A per-photo list of detected changes (new stains, holes, missing fixtures, scuff marks).
- A wear-and-tear classification per change (normal / borderline / damage).
- A suggested fair split in DEPG with a one-paragraph rationale.

**Model options:**
- GPT-4V / Claude 3.5 Sonnet vision via API (fastest to ship).
- CLIP embeddings + cosine distance for cheap pre-screening (flag photos with high drift before sending to the expensive model).
- Optional: YOLOv8 fine-tune on a small indoor damage dataset for on-device inference (stretch goal, not needed for demo).

**UX:**
- New "AI Analysis" panel on `/resolve/[id]` and `/arbitrate/[id]`.
- Shows thumbnails with bounding boxes/highlights on detected changes.
- Shows a suggested split, which the landlord can accept (pre-fills the propose-release form) or override.
- The AI output is **advisory only** — the on-chain `propose_release` / `arbitrate` instructions are unchanged.

**Storage:**
- `inspection_data` field on `tenancies` (already added to type) stores the AI JSON report.
- Optionally hash the JSON and write the hash on-chain alongside `inspector_move_in_hash` so the analysis is tamper-evident.

### 2.2 AI Arbitrator Simulator — **Recommended P1**

**What:** When a tenancy enters `Disputed`, an LLM reviews the full case (lease terms, inspection tier, move-in hash, move-out photos, landlord's proposed split, tenant's counter-claim) and outputs a non-binding recommended split with reasoning grounded in RTB guidance.

**Model:** Claude Sonnet 4.6 or GPT-4 Turbo. System prompt seeded with RTB wear-and-tear rubric.

**UX:**
- Visible to both parties on `/resolve/[id]` after dispute is raised.
- Visible to human arbitrator on `/arbitrate/[id]` as a decision aid.
- Stored in `arbitration_reasoning` (field already exists on the type).
- Explicitly labelled "AI suggestion — not binding".

**Why it works for the demo:** gives the arbitrator page a second column of "AI reasoning" next to the human decision — shows the product scaling without needing human arbitrators at every dispute.

### 2.3 Dispute Risk Score — **P2 / optional**

**What:** At tenancy creation, a small model predicts the probability this tenancy ends in dispute based on: deposit size, lease length, inspection tier chosen, and landlord/tenant track record (after enough data exists).

**Model:** Logistic regression or gradient-boosted trees. Cold start: hand-coded heuristic until data exists.

**UX:** A small badge on `/create` and `/dashboard` — "Dispute risk: low / medium / high" — that nudges the landlord to book an inspector (tier 1) when the score is high.

**Status:** Skip for the hackathon unless there is leftover time in Week 4. It does not carry the demo.

---

## 3. Updated feature prioritisation (replaces base PRD §Feature Prioritisation if AI track is taken)

- **P0 (unchanged):** wallet connect, create tenancy, move-in hashing, deposit to escrow PDA, propose/approve release, dispute, arbitrate, dashboard.
- **P1:** inspector tier, auto-release after 14 days past lease end, **AI damage detection (§2.1)**, **AI arbitrator simulator (§2.2)**.
- **P2:** multi-property view, dispute risk scoring (§2.3), RTB export PDF, USDC deposits.

---

## 4. Architecture deltas

No changes to the on-chain program. All AI work happens in Next.js API routes.

**New routes:**
- `POST /api/ai-analyze` — input: tenancy_id. Fetches move-in and move-out photos from Supabase Storage, calls the vision model, stores the JSON result in `tenancies.inspection_data`, returns the analysis.
- `POST /api/ai-arbitrate` — input: tenancy_id. Fetches full case, calls the LLM, stores suggestion in `tenancies.arbitration_reasoning`, returns the recommendation.

**New env vars:**
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (server-side only, never `NEXT_PUBLIC_`).
- `AI_ANALYSIS_ENABLED` feature flag so the AI track can be toggled off if it breaks during the demo.

**New shared component:**
- `src/components/AIAnalysisPanel.tsx` — renders the JSON report with bounding boxes and the suggested split. Reused on `/resolve` and `/arbitrate`.

---

## 5. Demo script deltas

Insert after the "tenant pays deposit" beat in the base demo script:

1. Landlord uploads move-out photos.
2. **[NEW]** "AI Analysis" panel appears — model detects a new stain on the carpet and a missing smoke alarm, classifies the stain as borderline wear-and-tear and the alarm as damage, and suggests a split of 0.3 DEPG to landlord / 1.7 DEPG to tenant.
3. Landlord accepts the AI suggestion — form auto-fills.
4. On-chain `propose_release` transaction fires with that split.
5. Tenant reviews the AI reasoning, agrees, approves on-chain.
6. Escrow releases automatically.

This replaces ~30 seconds of "landlord types in a number" with a visibly AI-driven beat, which is what judges remember.

---

## 6. Risk / cost / timeline

**Risk:** vision model hallucinations on edge-case photos. Mitigation: always show the model's output as advisory, never as binding; keep the human-accept step.

**Cost:** ~$0.01–0.03 per arbitration call (GPT-4V). Negligible for hackathon and early users.

**Timeline if taken now (2026-04-17 → 2026-05-10):**
- Week 2 remainder (3 days): scaffold `/api/ai-analyze`, `/api/ai-arbitrate`, and `AIAnalysisPanel`.
- Week 3 (7 days): integrate into `/resolve` and `/arbitrate` pages; tune prompts.
- Week 4 (7 days): demo video, polish, submission.

**Decision gate:** if the on-chain deploy (Anchor program to devnet, mutual sign-off) is not working by **2026-04-24**, drop the AI track and ship base P0 only. The escrow has to work first.

---

## 7. Switch-on checklist

When flipping from base PRD to AI track:

1. Set `AI_ANALYSIS_ENABLED=true` in `.env.local`.
2. Add `ANTHROPIC_API_KEY` to `.env.local`.
3. Implement `/api/ai-analyze` and `/api/ai-arbitrate` route handlers.
4. Add `AIAnalysisPanel` import to `src/app/resolve/[id]/page.tsx` and `src/app/arbitrate/[id]/page.tsx`.
5. Update demo script to include the AI beat (§5).
6. Update the README one-liner from "DepositGuard escrow for Irish rent deposits" to "AI-assisted DepositGuard escrow for Irish rent deposits".
