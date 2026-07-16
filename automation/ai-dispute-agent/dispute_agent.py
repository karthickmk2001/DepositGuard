import os, json, base64, sys
import urllib.request

CASE_DIR = sys.argv[1] if len(sys.argv) > 1 else "sample_case"
API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = "gpt-4o"

RUBRIC = """You are a tenancy dispute analyst for DepositGuard, an Irish rent deposit escrow platform.
You are given move-in and move-out photos of the same rooms plus the case details.
Follow RTB (Residential Tenancies Board) guidance: normal wear and tear (faded paint, minor
scuffs, worn carpet from normal use) must NOT be charged to the tenant. Actual damage
(stains, holes, burns, missing or broken fixtures) may be deducted, allowing for depreciation.
Respond ONLY with JSON in this exact shape:
{"changes":[{"room":"","description":"","classification":"wear_and_tear|borderline|damage","suggested_deduction_eur":0}],
"total_deduction_eur":0,"tenant_refund_eur":0,"reasoning":""}"""

def img_block(path):
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + data}}

def call_llm(case, content):
    body = json.dumps({
        "model": MODEL, "max_tokens": 1500,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": RUBRIC},
                     {"role": "user", "content": content}]
    }).encode()
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body, headers={
        "content-type": "application/json", "authorization": "Bearer " + API_KEY})
    with urllib.request.urlopen(req) as r:
        out = json.loads(r.read())
    text = out["choices"][0]["message"]["content"]
    return json.loads(text.replace("```json", "").replace("```", "").strip())

def mock_report(case):
    # offline fallback so the demo runs without an API key
    deposit = case["deposit_eur"]
    changes = [
        {"room": "livingroom", "description": "Large dark stain on carpet not present at move-in",
         "classification": "damage", "suggested_deduction_eur": round(deposit * 0.10)},
        {"room": "kitchen", "description": "Minor scuffs on wall near counter",
         "classification": "wear_and_tear", "suggested_deduction_eur": 0},
        {"room": "bedroom", "description": "Small hole in wall, likely from shelf bracket",
         "classification": "borderline", "suggested_deduction_eur": round(deposit * 0.03)},
    ]
    total = sum(c["suggested_deduction_eur"] for c in changes)
    return {"changes": changes, "total_deduction_eur": total, "tenant_refund_eur": deposit - total,
            "reasoning": "Carpet stain classified as damage under RTB guidance as it exceeds normal "
                         "use. Wall scuffs are ordinary wear and tear so no deduction. The bracket hole "
                         "is borderline; a small deduction covers filler and paint with depreciation applied."}

def run():
    with open(os.path.join(CASE_DIR, "case.json")) as f:
        case = json.load(f)

    if API_KEY:
        content = [{"type": "text", "text": "Case details:\n" + json.dumps(case, indent=2)}]
        for phase in ["movein", "moveout"]:
            folder = os.path.join(CASE_DIR, phase)
            for name in sorted(os.listdir(folder)):
                content.append({"type": "text", "text": f"{phase} photo: {name}"})
                content.append(img_block(os.path.join(folder, name)))
        content.append({"type": "text", "text": "Compare the photo pairs and produce the JSON report."})
        report = call_llm(case, content)
        mode = "live"
    else:
        report = mock_report(case)
        mode = "mock"

    out = os.path.join(CASE_DIR, "ai_report.json")
    with open(out, "w") as f:
        json.dump(report, f, indent=2)

    print(f"--- DepositGuard AI dispute analysis ({mode}) ---")
    print(f"Case: {case['tenancy_id']}  Deposit: EUR {case['deposit_eur']}")
    for c in report["changes"]:
        print(f"  {c['room']:<12} {c['classification']:<14} EUR {c['suggested_deduction_eur']:<5} {c['description']}")
    print(f"Suggested deduction: EUR {report['total_deduction_eur']}")
    print(f"Tenant refund:       EUR {report['tenant_refund_eur']}")
    print(f"\nReasoning: {report['reasoning']}")
    print(f"\nSaved {out} (advisory only, not binding)")

if __name__ == "__main__":
    run()
