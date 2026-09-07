/**
 * Adaptive review sessions.
 *
 * Builds a short mixed quiz that focuses on the concepts the student has
 * actually got wrong (from concept_performance), pulling the relevant passages
 * out of the documents those concepts came from. When there is no history yet,
 * it falls back to the most recently updated document so a first session still
 * works.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuizQuestion } from "@/lib/documents.functions";

export interface ReviewQuestion extends QuizQuestion {
  topic: string;
  documentId: string;
  documentTitle: string;
}

export interface ReviewSession {
  questions: ReviewQuestion[];
  /** Concepts this session is built around, worst first. */
  focus: Array<{ topic: string; accuracy: number; documentTitle: string }>;
  /** True when we had no performance history and picked a document for them. */
  coldStart: boolean;
}

/** Generate a review session across the student's weakest concepts. */
export const buildReviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ count: z.number().int().min(4).max(12).default(6) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ReviewSession> => {
    const { data: concepts } = await context.supabase
      .from("concept_performance")
      .select("topic, attempts, correct, document_id, last_seen_at, documents(title)")
      .order("last_seen_at", { ascending: false })
      .limit(200);

    const weak = (concepts ?? [])
      .map((r: any) => ({
        topic: r.topic as string,
        documentId: r.document_id as string,
        documentTitle: (r.documents?.title as string) ?? "Untitled document",
        accuracy: r.attempts > 0 ? r.correct / r.attempts : 0,
      }))
      .filter((c) => c.accuracy < 0.85)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    let documentIds = Array.from(new Set(weak.map((w) => w.documentId)));
    const coldStart = documentIds.length === 0;

    if (coldStart) {
      const { data: recent } = await context.supabase
        .from("documents")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);
      documentIds = (recent ?? []).map((r: any) => r.id as string);
    }
    if (documentIds.length === 0) {
      throw new Error("Add a document first — there is nothing to review yet.");
    }

    const { data: docs, error } = await context.supabase
      .from("documents")
      .select("id, title, content")
      .in("id", documentIds.slice(0, 3));
    if (error) throw new Error(error.message);
    if (!docs?.length) throw new Error("Could not load the material for this review.");

    const { retrievePassages } = await import("@/lib/retrieval.server");
    const { callAI, trimDoc } = await import("@/lib/ai.server");
    const { personaPrompt } = await import("@/lib/persona.server");
    const persona = await personaPrompt(context.supabase, context.userId);
    const { parseJson } = await import("@/lib/review.server");

    const perDoc = Math.max(2, Math.round(data.count / docs.length));
    const questions: ReviewQuestion[] = [];

    for (const doc of docs as Array<{ id: string; title: string; content: string }>) {
      const topics = weak.filter((w) => w.documentId === doc.id).map((w) => w.topic);
      // Focus the excerpts on the weak concepts; otherwise use the whole doc.
      const material = topics.length
        ? retrievePassages(doc.content, topics.join(" "), 6)
            .map((p) => p.text)
            .join("\n\n")
        : trimDoc(doc.content);

      const raw = await callAI({
        messages: [
          {
            role: "system",
            content:
              'You write spaced-repetition review questions. Reply with strict JSON only: {"questions":[{"question":string,"choices":[string,string,string,string],"answerIndex":number,"explanation":string,"topic":string}]}. Exactly 4 choices, answerIndex 0-3. Only use facts present in the material. "topic" is a 1-4 word concept label; reuse the given focus labels when they fit. Explanations are one or two sentences and teach the idea, not just the answer.' +
              persona,
          },
          {
            role: "user",
            content:
              `Write ${perDoc} review questions from "${doc.title}".` +
              (topics.length
                ? ` The student keeps getting these concepts wrong, so prioritise them: ${topics.join(", ")}.`
                : "") +
              `\nReturn ONLY the JSON.\n\n${material}`,
          },
        ],
      });

      const parsed = parseJson<{ questions: QuizQuestion[] }>(raw);
      for (const q of parsed?.questions ?? []) {
        if (!Array.isArray(q.choices) || q.choices.length !== 4) continue;
        questions.push({
          ...q,
          topic: (q.topic ?? "General").slice(0, 80),
          documentId: doc.id,
          documentTitle: doc.title,
        });
      }
    }

    if (questions.length === 0) throw new Error("The review could not be generated — please try again.");

    return {
      questions: questions.slice(0, data.count),
      focus: weak.map((w) => ({ topic: w.topic, accuracy: w.accuracy, documentTitle: w.documentTitle })),
      coldStart,
    };
  });
