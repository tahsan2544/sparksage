/**
 * Server-side enforcement of plan limits.
 *
 * Limits live in the database (`plans` / `plan_features`) so the Owner can tune
 * them without a deploy. Every AI/creation server function calls
 * `enforceLimit()` before doing paid work, so quotas are real rather than
 * cosmetic UI hints.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Feature keys that are metered. */
export type MeteredFeature =
  | "documents"
  | "ai_chat_messages_per_day"
  | "quiz_generations_per_day"
  | "flashcard_generations_per_day"
  | "summaries_per_day";

/** Per-day features reset at midnight UTC; `documents` is a lifetime total. */
const DAILY: MeteredFeature[] = [
  "ai_chat_messages_per_day",
  "quiz_generations_per_day",
  "flashcard_generations_per_day",
  "summaries_per_day",
];

const LABEL: Record<MeteredFeature, string> = {
  documents: "documents",
  ai_chat_messages_per_day: "AI chat messages today",
  quiz_generations_per_day: "quiz generations today",
  flashcard_generations_per_day: "flashcard generations today",
  summaries_per_day: "summaries today",
};

/** Thrown when a quota is exhausted so the UI can offer an upgrade. */
export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT_REACHED";
  constructor(
    readonly feature: MeteredFeature,
    readonly limit: number,
  ) {
    super(
      `You've used all ${limit} ${LABEL[feature]} included in your plan. Upgrade to Pro for more.`,
    );
    this.name = "PlanLimitError";
  }
}

function windowStart(feature: MeteredFeature): string | null {
  if (!DAILY.includes(feature)) return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Look up the caller's limit for a feature. `null` = unlimited. */
async function limitFor(
  supabase: SupabaseClient,
  userId: string,
  feature: MeteredFeature,
): Promise<number | null> {
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub?.plan_id) return null;

  const { data: row } = await supabase
    .from("plan_features")
    .select("max_usage, is_visible")
    .eq("plan_id", sub.plan_id)
    .eq("feature_key", feature)
    .maybeSingle();

  if (!row) return null;
  if (row.is_visible === false) return 0; // feature disabled for this plan
  return row.max_usage;
}

/** Count how much of a feature the caller has already used in the window. */
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

export interface UsageStat {
  feature: MeteredFeature;
  used: number;
  limit: number | null;
}

/**
 * Throw when the caller has no quota left. Owners are never limited.
 * Call this BEFORE doing the expensive work, then `recordUsage()` after.
 */
export async function enforceLimit(
  supabase: SupabaseClient,
  userId: string,
  feature: MeteredFeature,
): Promise<void> {
  const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (isOwner) return;

  const limit = await limitFor(supabase, userId, feature);
  if (limit === null) return; // unlimited

  const used = await usedCount(supabase, userId, feature);
  if (used >= limit) throw new PlanLimitError(feature, limit);
}

/** All metered features with current usage, for the in-app usage meters. */
export async function usageSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStat[]> {
  const features: MeteredFeature[] = ["documents", ...DAILY];
  return Promise.all(
    features.map(async (feature) => ({
      feature,
      used: await usedCount(supabase, userId, feature),
      limit: await limitFor(supabase, userId, feature),
    })),
  );
}
