# DepositGuard Automation (H9IAPA CA)

Two automation solutions built around the DepositGuard deposit escrow platform.

> Note: `../h9iapa-ca/` contains a second, independent implementation of the
> same coursework (text-based classifier instead of photo-vision, plus a
> full drafted report.docx). Both are kept for now — see its README for
> details if you're deciding which to submit.

## 1. RPA onboarding bot (rpa-onboarding-bot/)
Rule-based bot that automates tenancy intake administration:
- reads new tenancies from new_tenancies.xlsx
- validates deposit, emails, dates, address
- computes SHA-256 hashes of move-in photos
- appends valid records to tenancy_register.csv (escrow created)
- sends confirmation / rejection emails (DRY_RUN writes .eml files to outbox/)

Run: `python3 onboarding_bot.py`
Needs: `pip install openpyxl`
Idempotent: each row in new_tenancies.xlsx is marked processed="yes" once handled
(accepted or rejected), so re-running the bot does not duplicate register entries
or re-send emails. Reset a row's "processed" cell to blank to reprocess it.

## 2. AI dispute agent (ai-dispute-agent/)
Agentic solution that analyses a deposit dispute:
- loads case.json plus move-in and move-out photos
- sends both photo sets to a vision LLM (OpenAI GPT-4o) with an RTB wear-and-tear rubric
- classifies each change (wear_and_tear / borderline / damage)
- outputs a suggested deposit split with reasoning to ai_report.json (advisory only)

Run: `OPENAI_API_KEY=... python3 dispute_agent.py sample_case`
Without a key it falls back to a mock report so the pipeline can be demoed offline.

Note on API keys: no key is committed in this repo (a live OpenAI key should
never be checked into a submitted project). sample_case/ai_report.json is kept
as-is from a genuine live run against gpt-4o (mode: "live") — it is evidence
the real pipeline works, not the mock fallback. To reproduce it yourself,
export your own OPENAI_API_KEY and re-run the command above; the report will
be overwritten with a fresh live result. Cite this in the report so it is
clear the implementation was actually exercised against the real API, per the
CA brief's requirement to demonstrate solutions using external APIs.

## BPMN (../bpmn/)
- as_is_deposit_process.drawio - manual Irish deposit process with RTB dispute path
- to_be_depositguard_process.drawio - automated process; purple tasks are the two solutions

## AI usage disclosure
Parts of this project were developed with AI assistance (Anthropic Claude), as
disclosed in the report per the CA brief. All results shown were genuinely
produced by running the included code.
