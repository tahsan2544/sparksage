/**
 * Study performance layer.
 *
 * Records real quiz and flashcard outcomes (never invented analytics) and turns
 * them into per-concept mastery so the dashboard can show honest "weak areas"
 * and a concrete "what should I do next" plan.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const topicResult = z.object({
  topic: z.string().trim().min(1).max(80),
  correct: z.boolean(),
});

/** Record a finished quiz run plus per-concept results. */
export const recordQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        documentId: uuid,
        total: z.number().int().min(1).max(100),
        correct: z.number().int().min(0).max(100),
        durationSeconds: z.number().int().min(0).max(24 * 60 * 60).default(0),
        results: z.array(topicResult).max(100).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quiz_attempts").insert({
      user_id: context.userId,
      document_id: data.documentId,
      total: data.total,
      correct: data.correct,
      duration_seconds: data.durationSeconds,
    });
    if (error) throw new Error(error.message);

    await upsertConcepts(context.supabase, context.userId, data.documentId, "quiz", data.results);
    return { ok: true };
  });

/** Record a flashcard study run: each card graded "known" or "review again". */
export const recordFlashcardRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        documentId: uuid,
        results: z.array(topicResult).max(200).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await upsertConcepts(context.supabase, context.userId, data.documentId, "flashcard", data.results);
    return { ok: true };
  });

/** Merge a batch of per-topic outcomes into concept_performance. */
async function upsertConcepts(
  supabase: { from: (t: string) => any },
  userId: string,
  documentId: string,
  source: "quiz" | "flashcard",
  results: Array<{ topic: string; correct: boolean }>,
) {
  if (results.length === 0) return;

  // Aggregate in memory first so one topic answered twice is a single write.
  const merged = new Map<string, { attempts: number; correct: number }>();
  for (const r of results) {
    const key = r.topic.trim().slice(0, 80);
    const cur = merged.get(key) ?? { attempts: 0, correct: 0 };
    cur.attempts += 1;
    if (r.correct) cur.correct += 1;
    merged.set(key, cur);
  }

  const topics = Array.from(merged.keys());
  const { data: existing } = await supabase
    .from("concept_performance")
    .select("id, topic, attempts, correct")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .in("topic", topics);

  const byTopic = new Map<string, { id: string; attempts: number; correct: number }>();
  for (const row of existing ?? []) byTopic.set(row.topic, row);

  const rows = topics.map((topic) => {
    const add = merged.get(topic)!;
    const prev = byTopic.get(topic);
    return {
      ...(prev ? { id: prev.id } : {}),
      user_id: userId,
      document_id: documentId,
      topic,
      source,
      attempts: (prev?.attempts ?? 0) + add.attempts,
      correct: (prev?.correct ?? 0) + add.correct,
      last_seen_at: new Date().toISOString(),
    };
  });

  await supabase.from("concept_performance").upsert(rows, { onConflict: "user_id,document_id,topic" });
}

export interface WeakArea {
  topic: string;
  documentId: string | null;
  documentTitle: string | null;
  attempts: number;
  correct: number;
  accuracy: number;
  status: "needs_review" | "improving" | "strong";
}

/** Concepts the student is actually struggling with, worst first. */
export const getWeakAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WeakArea[]> => {
    const { data, error } = await context.supabase
      .from("concept_performance")
      .select("topic, attempts, correct, document_id, last_seen_at, documents(title)")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return (data ?? [])
      .map((r: any) => {
        const accuracy = r.attempts > 0 ? r.correct / r.attempts : 0;
        return {
          topic: r.topic as string,
          documentId: (r.document_id as string) ?? null,
          documentTitle: (r.documents?.title as string) ?? null,
          attempts: r.attempts as number,
          correct: r.correct as number,
          accuracy,
          status:
            accuracy < 0.5 ? "needs_review" : accuracy < 0.8 ? "improving" : "strong",
        } as WeakArea;
      })
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);
  });

/** Recent quiz scores, newest first — used for the progress page. */
export const getQuizHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quiz_attempts")
      .select("id, total, correct, duration_seconds, created_at, documents(title)")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id as string,
      total: r.total as number,
      correct: r.correct as number,
      durationSeconds: r.duration_seconds as number,
      createdAt: r.created_at as string,
      documentTitle: (r.documents?.title as string) ?? "Untitled document",
    }));
  });
