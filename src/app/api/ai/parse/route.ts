import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

type AiParseResult = {
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  reminder: boolean;
  urgent: boolean;
  important: boolean;
  timeSource: "explicit" | "guessed" | "none";
};

function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeResult(raw: Partial<AiParseResult>): AiParseResult {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  const dueDate = typeof raw.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null;
  const dueTime = typeof raw.dueTime === "string" && /^\d{2}:\d{2}$/.test(raw.dueTime) ? raw.dueTime : null;
  const timeSource = raw.timeSource === "explicit" || raw.timeSource === "guessed" ? raw.timeSource : "none";
  return {
    title,
    notes,
    dueDate,
    dueTime: dueDate ? dueTime : null,
    reminder: Boolean(raw.reminder),
    urgent: Boolean(raw.urgent),
    important: Boolean(raw.important),
    timeSource: dueDate ? (dueTime ? timeSource : "none") : "none",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { text, today, timezone } = (await req.json()) as {
      text?: string;
      today?: string;
      timezone?: string;
    };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing text input." }, { status: 400 });
    }

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

    if (!endpoint || !apiKey || !deployment) {
      return NextResponse.json({ error: "Azure OpenAI env vars are not configured." }, { status: 500 });
    }

    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const system = [
      "Return ONLY valid JSON.",
      "Fields: title, notes, dueDate (YYYY-MM-DD or null), dueTime (HH:mm or null), reminder, urgent, important, timeSource (explicit|guessed|none).",
      `Today: ${today || "unknown"}; Timezone: ${timezone || "unknown"}.`,
      "If weekday/relative date -> next valid date.",
      "If date but no time -> guess time and set timeSource=guessed.",
      "If explicit time -> timeSource=explicit.",
      "If no date -> dueDate/dueTime null, timeSource=none.",
      "Title short; notes optional.",
    ].join("\n");

    const callAzure = async (maxTokens: number) => {
      return fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          max_completion_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: text.trim() },
          ],
        }),
      });
    };

    let response = await callAzure(600);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Azure OpenAI request failed.", status: response.status, detail: errorText },
        { status: 500 }
      );
    }

    let data = await response.json();
    let content = data?.choices?.[0]?.message?.content;
    const finishReason = data?.choices?.[0]?.finish_reason;
    if ((!content || typeof content !== "string") && finishReason === "length") {
      response = await callAzure(1000);
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: "Azure OpenAI request failed.", status: response.status, detail: errorText },
          { status: 500 }
        );
      }
      data = await response.json();
      content = data?.choices?.[0]?.message?.content;
    }
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "No AI response content.", detail: JSON.stringify(data) },
        { status: 500 }
      );
    }

    let parsed: Partial<AiParseResult> | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const candidate = firstJsonObject(content);
      if (candidate) {
        try {
          parsed = JSON.parse(candidate);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse AI output." }, { status: 500 });
    }

    return NextResponse.json(normalizeResult(parsed));
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error in AI parse.", detail: String(err) }, { status: 500 });
  }
}
