import { scoreOpportunity, suggestedPublicReply } from "@/lib/scoring";

type AiOpportunityResult = {
  summary: string;
  intentCategory: string;
  suggestedPublicReply: string;
};

export async function analyzeOpportunityWithAi(publicTextSnippet: string): Promise<AiOpportunityResult> {
  if (!process.env.OPENAI_API_KEY) {
    const scored = scoreOpportunity({ text: publicTextSnippet });
    return {
      summary: `${scored.intentCategory} signal with score ${scored.intentScore}.`,
      intentCategory: scored.intentCategory,
      suggestedPublicReply: suggestedPublicReply(publicTextSnippet),
    };
  }

  try {
    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Classify Dubai real estate public conversations. Never suggest deceptive, manipulative, spammy, automatic DM, or automatic comment behavior. Replies must be helpful, educational, public, and invite opt-in only.",
          },
          {
            role: "user",
            content: `Return compact JSON with keys summary, intentCategory, suggestedPublicReply for this public text: ${publicTextSnippet}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) throw new Error(`AI provider failed: ${response.status}`);
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned no content.");
    const parsed = JSON.parse(content) as Partial<AiOpportunityResult>;
    return {
      summary: parsed.summary || "Public Dubai property conversation.",
      intentCategory: parsed.intentCategory || scoreOpportunity({ text: publicTextSnippet }).intentCategory,
      suggestedPublicReply: parsed.suggestedPublicReply || suggestedPublicReply(publicTextSnippet),
    };
  } catch {
    const scored = scoreOpportunity({ text: publicTextSnippet });
    return {
      summary: `${scored.intentCategory} signal with score ${scored.intentScore}.`,
      intentCategory: scored.intentCategory,
      suggestedPublicReply: suggestedPublicReply(publicTextSnippet),
    };
  }
}
