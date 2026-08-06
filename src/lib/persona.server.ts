/**
 * AI personalization.
 *
 * Every student can set a preferred tone, explanation style, language and
 * free-text instructions in Settings. `personaPrompt()` turns those choices
 * into a system-prompt fragment that is appended to every AI request so the
 * tutor, summaries, quizzes, flashcards and Document Studio all sound the same.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AiPersona {
  tone: string;
  style: string;
  language: string;
  instructions: string;
}

const TONE_HINT: Record<string, string> = {
  friendly: "Warm, friendly and conversational.",
  formal: "Formal, precise and professional.",
  concise: "Very concise — no filler, no preamble.",
  encouraging: "Encouraging and motivating; celebrate progress.",
};

const STYLE_HINT: Record<string, string> = {
  simple: "Explain like the student is a complete beginner (ELI5): plain words, everyday analogies, small steps.",
  balanced: "Balance clarity with depth: plain language first, then the important detail.",
  detailed: "Give detailed, technical explanations with correct terminology and underlying reasoning.",
};

/** Build the persona fragment for a user. Returns "" when nothing is set. */
export async function personaPrompt(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_preferences")
    .select("ai_tone, ai_style, ai_language, ai_instructions")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "";
  return formatPersona({
    tone: data.ai_tone ?? "friendly",
    style: data.ai_style ?? "balanced",
    language: data.ai_language ?? "English",
    instructions: data.ai_instructions ?? "",
  });
}

export function formatPersona(p: AiPersona): string {
  const lines = [
    "\n\n--- Student preferences (always follow these) ---",
    `Tone: ${TONE_HINT[p.tone] ?? p.tone}`,
    `Explanation style: ${STYLE_HINT[p.style] ?? p.style}`,
    `Write in ${p.language || "English"}.`,
  ];
  if (p.instructions.trim()) {
    lines.push(`Custom instructions from the student: ${p.instructions.trim().slice(0, 1000)}`);
  }
  lines.push("Keep any requested JSON structure exactly as specified, but honour the preferences above in the text.");
  return lines.join("\n");
}
