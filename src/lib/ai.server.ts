// Server-only helper for calling the Lovable AI Gateway.
// LOVABLE_API_KEY is auto-provisioned; never expose it to the client.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface CallOpts {
  messages: ChatMessage[];
  model?: string;
  // Optional JSON schema for structured output (OpenAI-style response_format).
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

/**
 * Call the Lovable AI Gateway with chat-completions and return the assistant text.
 * Throws a friendly error on 402/429 so the UI can surface it.
 */
export async function callAI({ messages, model = "google/gemini-3.5-flash", jsonSchema }: CallOpts): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const body: Record<string, unknown> = { model, messages };
  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema },
    };
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace billing settings.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response.");
  return content;
}

/** Trim document content so we never blow past the model's context window. */
export function trimDoc(content: string, maxChars = 24_000): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "\n\n[...truncated for AI processing...]";
}
