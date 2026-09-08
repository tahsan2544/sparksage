/**
 * Exam preparation mode.
 *
 * A student gives us the exam date, subject, topics and how long they can
 * study each day. We combine that with their real materials and their real
 * weak areas, then ask the model for a day-by-day revision schedule that fits
 * inside the time they actually have. Plans are stored so they can come back
 * to them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ExamDay {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  /** "Study", "Practice test" or "Revision". */
  focus: string;
  topics: string[];
  activities: string[];
  minutes: number;
}

export interface ExamPlan {
  id: string;
  subject: string;
  examDate: string;
  topics: string[];
  minutesPerDay: number;
  notes: string | null;
  days: ExamDay[];
  createdAt: string;
}

const daySchema = z.object({
  date: z.string(),
  focus: z.string(),
  topics: z.array(z.string()).default([]),
  activities: z.array(z.string()).default([]),
  minutes: z.number().int().min(0).max(600),
});

function toPlan(row: any): ExamPlan {
  const days = Array.isArray(row.plan) ? row.plan : [];
  return {
    id: row.id,
    subject: row.subject,
    examDate: row.exam_date,
    topics: row.topics ?? [],
    minutesPerDay: row.minutes_per_day,
    notes: row.notes ?? null,
    days: days.filter((d: unknown) => daySchema.safeParse(d).success),
    createdAt: row.created_at,
  };
}

/** All of the student's saved exam plans, soonest exam first. */
export const listExamPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExamPlan[]> => {
    const { data, error } = await context.supabase
      .from("exam_plans")
      .select("*")
      .order("exam_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toPlan);
  });

export const deleteExamPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("exam_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const createSchema = z.object({
  subject: z.string().trim().min(2).max(120),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid exam date."),
  topics: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  minutesPerDay: z.number().int().min(15).max(480).default(60),
});

/**
 * Build a realistic revision schedule and save it.
 * The prompt is grounded in the student's own document titles and measured
 * weak areas; when there is not enough time for everything, the model is told
 * to prioritise rather than invent an impossible plan.
 */
export const createExamPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }): Promise<ExamPlan> => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const exam = new Date(`${data.examDate}T00:00:00Z`);
    const daysLeft = Math.round((exam.getTime() - today.getTime()) / 86_400_000);
    if (daysLeft < 0) throw new Error("That exam date is in the past.");

    const [{ data: docs }, { data: concepts }] = await Promise.all([
      context.supabase.from("documents").select("title").order("updated_at", { ascending: false }).limit(25),
      context.supabase
        .from("concept_performance")
        .select("topic, attempts, correct")
        .order("last_seen_at", { ascending: false })
        .limit(60),
    ]);

    const weak = (concepts ?? [])
      .map((c: any) => ({ topic: c.topic as string, accuracy: c.attempts > 0 ? c.correct / c.attempts : 0 }))
      .filter((c) => c.accuracy < 0.8)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);

    const materials = (docs ?? []).map((d: any) => d.title as string);

    const { callAI } = await import("@/lib/ai.server");
    const { personaPrompt } = await import("@/lib/persona.server");
    const persona = await personaPrompt(context.supabase, context.userId);

    const dates: string[] = [];
    for (let i = 0; i <= Math.min(daysLeft, 60); i++) {
      const d = new Date(today.getTime() + i * 86_400_000);
      dates.push(d.toISOString().slice(0, 10));
    }

    const prompt = `Build a revision schedule for this student.

Subject: ${data.subject}
Exam date: ${data.examDate} (${daysLeft} day${daysLeft === 1 ? "" : "s"} away, including today)
Time available: ${data.minutesPerDay} minutes per day
Topics the student listed: ${data.topics.length ? data.topics.join(", ") : "(none listed — use their materials)"}
Their uploaded materials: ${materials.length ? materials.join(", ") : "(none uploaded yet)"}
Measured weak areas (lowest accuracy first): ${
      weak.length ? weak.map((w) => `${w.topic} (${Math.round(w.accuracy * 100)}%)`).join(", ") : "(no quiz history yet)"
    }

RULES
- One entry per study day, using only these dates: ${dates.join(", ")}.
- Never plan more than ${data.minutesPerDay} minutes on a day.
- Give more time to the weak areas above.
- Include at least one practice test day and a final revision day before the exam when there is room.
- If there is not enough time to cover everything, cover the highest-value material and say so in the summary; do NOT pretend everything fits.
- Only reference topics and materials named above. Do not invent chapters or page numbers.

Reply with JSON only, no markdown fence:
{"summary":"2-3 sentence honest plan overview","days":[{"date":"yyyy-mm-dd","focus":"Study|Practice test|Revision","topics":["..."],"activities":["..."],"minutes":60}]}`;

    const raw = await callAI({
      model: "google/gemini-3.6-flash",
      messages: [
        {
          role: "system",
          content:
            "You are SparkSage's exam coach. You build realistic, honest study schedules and never overload a student." +
            persona,
        },
        { role: "user", content: prompt },
      ],
    });

    let summary = "";
    let days: ExamDay[] = [];
    try {
      const json = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, "").trim());
      summary = typeof json.summary === "string" ? json.summary : "";
      days = z.array(daySchema).parse(json.days ?? []).filter((d) => dates.includes(d.date));
    } catch {
      throw new Error("The coach could not build a plan just now. Try again in a moment.");
    }
    if (days.length === 0) throw new Error("The coach returned an empty plan. Try again.");

    const { data: row, error } = await context.supabase
      .from("exam_plans")
      .insert({
        user_id: context.userId,
        subject: data.subject,
        exam_date: data.examDate,
        topics: data.topics,
        minutes_per_day: data.minutesPerDay,
        notes: summary,
        plan: days as unknown as any,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toPlan(row);
  });
