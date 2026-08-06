/**
 * Usage accounting.
 *
 * SparkSage no longer has subscription tiers: every account gets the same
 * generous access. We still record how much of each AI feature is used so the
 * Owner's analytics (and abuse monitoring) keep working, but nothing is gated.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Feature keys that are tracked (for analytics only — never blocked). */
export type MeteredFeature =
  | "documents"
  | "ai_chat_messages_per_day"
  | "quiz_generations_per_day"
  | "flashcard_generations_per_day"
  | "summaries_per_day"
  | "document_studio_generations_per_day";

const DAILY: MeteredFeature[] = [
  "ai_chat_messages_per_day",
  "quiz_generations_per_day",
  "flashcard_generations_per_day",
  "summaries_per_day",
  "document_studio_generations_per_day",
];

function windowStart(feature: MeteredFeature): string | null {
  if (!DAILY.includes(feature)) return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Count how much of a feature the caller has used in the current window. */
export async function usedCount(
  supabase: SupabaseClient,
  userId: string,
  feature: MeteredFeature,
): Promise<number> {
  if (feature === "documents") {
    const { count } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return count ?? 0;
  }
  let q = supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", feature);
  const since = windowStart(feature);
  if (since) q = q.gte("created_at", since);
  const { count } = await q;
  return count ?? 0;
}

/** Record one unit of usage (service role — the table is read-only to clients). */
export async function recordUsage(userId: string, feature: MeteredFeature) {
  if (feature === "documents") return; // counted from the documents table itself
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("usage_events").insert({ user_id: userId, feature_key: feature });
}

/**
 * Kept as the single call-site hook for future safety limits. Today every
 * account is unlimited, so this never throws.
 */
export async function enforceLimit(
  _supabase: SupabaseClient,
  _userId: string,
  _feature: MeteredFeature,
): Promise<void> {
  return;
}
