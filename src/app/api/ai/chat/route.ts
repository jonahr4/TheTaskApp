import { NextResponse, type NextRequest } from "next/server";
import { firstJsonObject, normalizeTask } from "../parse/route";

export const runtime = "nodejs";

type AiTask = {
    title: string;
    notes: string;
    dueDate: string | null;
    dueTime: string | null;
    priority: "DO" | "SCHEDULE" | "DELEGATE" | "DELETE";
    group: string | null;
    timeSource: "explicit" | "guessed" | "none";
};

type ExistingTask = {
    title: string;
    dueDate?: string | null;
    dueTime?: string | null;
    group?: string | null;
    completed?: boolean;
    notes?: string;
};

type ChatResponse =
    | { type: "answer"; message: string }
    | { type: "tasks"; message: string; tasks: AiTask[] };

export async function POST(req: NextRequest) {
    try {
        const { text, today, timezone, groups, existingTasks } = (await req.json()) as {
            text?: string;
            today?: string;
            timezone?: string;
            groups?: string[];
            existingTasks?: ExistingTask[];
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

        // Build existing tasks context
        const tasksContext = Array.isArray(existingTasks) && existingTasks.length > 0
            ? existingTasks.map((t, i) => {
                const parts = [`${i + 1}. "${t.title}"`];
                if (t.dueDate) parts.push(`due: ${t.dueDate}${t.dueTime ? ` at ${t.dueTime}` : ""}`);
                if (t.group) parts.push(`list: ${t.group}`);
                if (t.completed) parts.push("(completed)");
                if (t.notes) parts.push(`notes: ${t.notes}`);
                return parts.join(" | ");
            }).join("\n")
            : "No existing tasks.";

        const system = [
            "You are a friendly task management assistant. You can do TWO things:",
            "1. ANSWER QUESTIONS about the user's existing tasks (schedule, deadlines, what's due, etc.)",
            "2. CREATE NEW TASKS when the user wants to add reminders or to-dos.",
            "",
            "Return ONLY valid JSON in this format:",
            '{ "type": "answer", "message": "your helpful response" }',
            "OR",
            '{ "type": "tasks", "message": "short description", "tasks": [ ... ] }',
            "",
            "For task creation, each task has: title, notes, dueDate (YYYY-MM-DD or null), dueTime (HH:mm or null), priority (DO|SCHEDULE|DELEGATE|DELETE), group (string or null), timeSource (explicit|guessed|none).",
            "",
            `Today: ${today || "unknown"}; Timezone: ${timezone || "unknown"}.`,
            `Available groups/lists: ${Array.isArray(groups) && groups.length ? groups.join(", ") : "none"}.`,
            "",
            "RULES FOR ANSWERING QUESTIONS:",
            "- Use the task list below to answer questions about what's due, upcoming deadlines, etc.",
            "- Be concise and friendly. Never use emoji.",
            "- If asked about a specific class or topic, search the task titles for matches.",
            "- FORMATTING IS CRITICAL:",
            "  - NEVER show raw ISO dates like '2026-02-19'. Use 'Feb 19' or relative ('tomorrow', 'this Friday').",
            "  - NEVER use 24-hour time like '09:00' or '17:00'. Always use '9:00 AM' or '5:00 PM'.",
            "  - Write in natural, conversational sentences. Avoid overly formal bullet lists with dashes.",
            "  - Keep it casual and scannable — like a helpful friend texting you a summary.",
            "  - Use **bold** (double asterisks) for section headers or key labels in your response.",
            "RULES FOR CREATING TASKS:",
            "- BE AGGRESSIVE about guessing dates: 'soon'/'asap' → 1-2 days, 'today'/'tonight' → today.",
            "- If weekday/relative date → next valid date.",
            "- Max 4 tasks per request.",
            "- Title short; notes optional but helpful.",
            "- Priority: infer from urgency; default DO.",
            "- Group: best matching list name if provided.",
            "",
            "The user's existing tasks:",
            tasksContext,
        ].join("\n");

        const callAzure = async (maxTokens: number, extraBody?: Record<string, unknown>) => {
            return fetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "api-key": apiKey,
                },
                body: JSON.stringify({
                    max_completion_tokens: maxTokens,
                    response_format: { type: "json_object" },
                    reasoning_effort: "medium",
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: text.trim() },
                    ],
                    ...(extraBody || {}),
                }),
            });
        };

        let response = await callAzure(5000);
        if (!response.ok) {
            const errorText = await response.text();
            if (errorText.includes("reasoning_effort")) {
                response = await callAzure(5000, { reasoning_effort: undefined });
            } else {
                return NextResponse.json(
                    { error: "Azure OpenAI request failed.", status: response.status, detail: errorText },
                    { status: 500 }
                );
            }
        }

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
            const retrySystem = `${system}\nReturn JSON immediately. Do not include analysis.`;
            response = await callAzure(800, {
                messages: [
                    { role: "system", content: retrySystem },
                    { role: "user", content: text.trim() },
                ],
            });
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

        // Parse the response
        let parsed: Record<string, unknown> | null = null;
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

        // Normalize into the correct response shape
        const responseType = parsed.type === "tasks" ? "tasks" : "answer";
        const message = typeof parsed.message === "string" ? parsed.message : "";

        if (responseType === "tasks") {
            const tasksRaw = Array.isArray(parsed.tasks) ? parsed.tasks : [];
            const tasks = tasksRaw
                .map((t: Partial<AiTask>) => normalizeTask(t))
                .slice(0, 3);

            const result: ChatResponse = { type: "tasks", message, tasks };
            return NextResponse.json(result);
        }

        const result: ChatResponse = { type: "answer", message };
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json(
            { error: "Unexpected error in AI chat.", detail: String(err) },
            { status: 500 }
        );
    }
}
