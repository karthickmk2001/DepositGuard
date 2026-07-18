import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an impartial rent-deposit dispute assessor for Irish
tenancies, following RTB (Residential Tenancies Board) norms. You will be given
the move-in condition notes, the move-out findings, and the total deposit amount
for one tenancy.

For EACH move-out finding, classify it as one of: "wear-and-tear" (normal
deterioration from ordinary use, not chargeable) or "damage" (chargeable, beyond
normal wear). Give a one-sentence reasoning for each classification, referencing
the move-in notes where relevant. Then estimate a specific EUR "amount" to
deduct for that individual item: a reasonable, realistic repair/replacement
cost for "damage" items, or exactly 0 for "wear-and-tear" items. Base each
amount on typical Irish repair/cleaning/replacement costs for that kind of
item — vary the amounts realistically per item rather than splitting the
deposit evenly.

The landlord's total suggested amount must equal the sum of all individual
item amounts, and must never exceed the total deposit — if item amounts would
add up to more than the deposit, scale them down proportionally so they fit.
The tenant's suggested amount is whatever remains of the deposit.

Respond ONLY with a JSON object of this exact shape:
{
  "items": [
    {"description": "...", "classification": "wear-and-tear" | "damage", "amount": <number>, "reasoning": "..."}
  ],
  "suggestedLandlordAmount": <number>,
  "suggestedTenantAmount": <number>,
  "rationale": "<2-4 sentence overall explanation of the split>"
}
The two suggested amounts must sum exactly to the total deposit amount given,
and suggestedLandlordAmount must equal the sum of each item's "amount".`;

interface AssessmentRequest {
  depositAmount: number;
  moveInNotes: string;
  moveOutFindings: string[];
}

interface AssessmentItem {
  description: string;
  classification: "wear-and-tear" | "damage";
  amount: number;
  reasoning: string;
}

interface AssessmentResult {
  items: AssessmentItem[];
  suggestedLandlordAmount: number;
  suggestedTenantAmount: number;
  rationale: string;
}

function buildUserPrompt({ depositAmount, moveInNotes, moveOutFindings }: AssessmentRequest): string {
  const findings = moveOutFindings.map((f) => `- ${f}`).join("\n");
  return (
    `Total deposit amount: EUR ${depositAmount.toFixed(2)}\n\n` +
    `Move-in condition notes:\n${moveInNotes}\n\n` +
    `Move-out findings:\n${findings}\n`
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: AssessmentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { depositAmount, moveInNotes, moveOutFindings } = body;
  if (
    typeof depositAmount !== "number" ||
    depositAmount <= 0 ||
    typeof moveInNotes !== "string" ||
    !moveInNotes.trim() ||
    !Array.isArray(moveOutFindings) ||
    moveOutFindings.filter((f) => typeof f === "string" && f.trim()).length === 0
  ) {
    return NextResponse.json(
      { error: "depositAmount (number > 0), moveInNotes (string), and moveOutFindings (non-empty string[]) are required." },
      { status: 400 }
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(body) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
    }

    const result = JSON.parse(raw) as AssessmentResult;
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI assessment failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
