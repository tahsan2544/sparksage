// Server functions for the Study Planner + Progress Analytics feature.
// All handlers run under requireSupabaseAuth so RLS enforces per-user access.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- Study goals ----------

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_goals")
      .select("id, title, subject, due_date, completed, created_at, updated_at")
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        subject: z.string().trim().max(80).optional().nullable(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("study_goals")
      .insert({
        title: data.title,
        subject: data.subject || null,
        due_date: data.due_date,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const toggleGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, completed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("study_goals")
      .update({ completed: data.completed })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("study_goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Study sessions ----------

export const logSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        duration_seconds: z.number().int().min(1).max(24 * 60 * 60),
        document_id: uuid.optional().nullable(),
        note: z.string().trim().max(280).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("study_sessions").insert({
      duration_seconds: data.duration_seconds,
      document_id: data.document_id ?? null,
      note: data.note ?? null,
      user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Aggregate analytics ----------

export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Last 30 days of sessions
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const [sessionsRes, docsRes, quizzesRes, decksRes] = await Promise.all([
      context.supabase
        .from("study_sessions")
        .select("duration_seconds, occurred_at")
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: true }),
      context.supabase.from("documents").select("id", { count: "exact", head: true }),
      context.supabase.from("quizzes").select("id", { count: "exact", head: true }),
      context.supabase.from("flashcard_decks").select("id", { count: "exact", head: true }),
    ]);

    if (sessionsRes.error) throw new Error(sessionsRes.error.message);

    const sessions = sessionsRes.data ?? [];

    // Bucket by local YYYY-MM-DD
    const perDay = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      perDay.set(dayKey(d), 0);
    }
    for (const s of sessions) {
      const k = dayKey(new Date(s.occurred_at));
      perDay.set(k, (perDay.get(k) ?? 0) + s.duration_seconds);
    }
    const daily = Array.from(perDay.entries()).map(([date, seconds]) => ({
      date,
      minutes: Math.round(seconds / 60),
    }));

    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    // Streak: consecutive days up to today with >0 minutes
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const mins = perDay.get(dayKey(d));
      if (mins && mins > 0) streak++;
      else if (i > 0) break; // today with 0 is allowed to still be a 0-streak
      else break;
    }

    return {
      daily,
      totalMinutes,
      sessionCount: sessions.length,
      streak,
      counts: {
        documents: docsRes.count ?? 0,
        quizzes: quizzesRes.count ?? 0,
        decks: decksRes.count ?? 0,
      },
    };
  });

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
