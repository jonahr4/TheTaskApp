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
            "You are a friendly, concise task assistant. Use emoji occasionally when answering questions. 📝",
            "Return ONLY valid JSON.",
            "",
            "You have TWO modes:",
            "",
            "MODE 1 — ANSWER: If the user is asking a question about their existing tasks, schedule, or needs information, respond with:",
            '{ "type": "answer", "message": "your helpful answer here" }',
            "",
            "MODE 2 — TASKS: If the user wants to create new tasks, respond with:",
            '{ "type": "tasks", "message": "short confirmation message", "tasks": [{ "title": "...", "notes": "...", "dueDate": "YYYY-MM-DD or null", "dueTime": "HH:mm or null", "priority": "DO|SCHEDULE|DELEGATE|DELETE", "group": "string or null", "timeSource": "explicit|guessed|none" }] }',
            "",
            "Rules for MODE 2 (creating tasks):",
            "- Max 3 tasks per response.",
            "- If weekday/relative date → compute the next valid date.",
            "- If date but no time → guess a reasonable time and set timeSource=guessed.",
            "- If explicit time → timeSource=explicit.",
            "- If no date → dueDate/dueTime null, timeSource=none.",
            "- Title should be short; notes are optional.",
            "- Priority should be inferred; default DO if unclear.",
            "- Group should be the best matching list name if provided; otherwise null.",
            "",
            `Today: ${today || "unknown"}; Timezone: ${timezone || "unknown"}.`,
            `Available groups/lists: ${Array.isArray(groups) && groups.length ? groups.join(", ") : "none"}.`,
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
