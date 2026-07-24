// Server functions covering documents, chat threads/messages, and AI-powered
// summaries, quizzes, and flashcards. All handlers run under
// `requireSupabaseAuth` so RLS enforces per-user access.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- Documents ----------

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, title, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(200_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({ title: data.title, content: data.content, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document not found");
    return doc;
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Chat threads & messages ----------

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, created_at, updated_at")
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid, title: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({
        document_id: data.documentId,
        user_id: context.userId,
        title: data.title?.trim() || "New chat",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Send a chat message, call AI with document + history, persist both turns.
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: uuid, content: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Load thread + document (RLS scopes to caller).
    const { data: thread, error: tErr } = await context.supabase
      .from("chat_threads")
      .select("id, document_id, title")
      .eq("id", data.threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread not found");

    const { data: doc, error: dErr } = await context.supabase
      .from("documents")
      .select("title, content")
      .eq("id", thread.document_id)
      .single();
    if (dErr) throw new Error(dErr.message);

    // Prior history
    const { data: history, error: hErr } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (hErr) throw new Error(hErr.message);

    // Persist the user turn first.
    const { data: userRow, error: uErr } = await context.supabase
      .from("chat_messages")
      .insert({ thread_id: data.threadId, user_id: context.userId, role: "user", content: data.content })
      .select("id, role, content, created_at")
      .single();
    if (uErr) throw new Error(uErr.message);

    const { callAI, trimDoc } = await import("@/lib/ai.server");
    const systemPrompt = `You are a helpful study assistant answering questions about a specific document.\nAlways ground your answer in the document. If the document does not contain the answer, say so plainly.\n\nDocument title: ${doc.title}\n---\n${trimDoc(doc.content)}\n---`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: data.content },
    ];

    let answer: string;
    try {
      answer = await callAI({ messages });
    } catch (e) {
      // Roll back the user message so the UI stays consistent.
      await context.supabase.from("chat_messages").delete().eq("id", userRow.id);
      throw e;
    }

    const { data: aiRow, error: aErr } = await context.supabase
      .from("chat_messages")
      .insert({ thread_id: data.threadId, user_id: context.userId, role: "assistant", content: answer })
      .select("id, role, content, created_at")
      .single();
    if (aErr) throw new Error(aErr.message);

    // Auto-title on the first exchange.
    if ((history?.length ?? 0) === 0 && thread.title === "New chat") {
      const title = data.content.slice(0, 60);
      await context.supabase.from("chat_threads").update({ title }).eq("id", thread.id);
    }

    return { userMessage: userRow, assistantMessage: aiRow };
  });

// ---------- AI: summary, quiz, flashcards ----------

export const getSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("document_summaries")
      .select("content, updated_at")
      .eq("document_id", data.documentId)
      .maybeSingle();
    return row ?? null;
  });

export const generateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("title, content")
      .eq("id", data.documentId)
      .single();
    if (error) throw new Error(error.message);

    const { callAI, trimDoc } = await import("@/lib/ai.server");
    const summary = await callAI({
      messages: [
        {
          role: "system",
          content:
            "You write concise, well-structured study summaries. Use short paragraphs and a bulleted list of key takeaways. Format with Markdown.",
        },
        {
          role: "user",
          content: `Summarize the following document titled "${doc.title}":\n\n${trimDoc(doc.content)}`,
        },
      ],
    });

    const { error: upErr } = await context.supabase
      .from("document_summaries")
      .upsert(
        { document_id: data.documentId, user_id: context.userId, content: summary },
        { onConflict: "document_id" },
      );
    if (upErr) throw new Error(upErr.message);
    return { content: summary };
  });

export type QuizQuestion = { question: string; choices: string[]; answerIndex: number; explanation: string };

export const getLatestQuiz = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("quizzes")
      .select("id, questions, created_at")
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ documentId: uuid, count: z.number().int().min(3).max(15).default(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("title, content")
      .eq("id", data.documentId)
      .single();
    if (error) throw new Error(error.message);

    const { callAI, trimDoc } = await import("@/lib/ai.server");
    const raw = await callAI({
      messages: [
        {
          role: "system",
          content:
            "You create high-quality multiple-choice study quizzes. Reply with strict JSON only, matching this shape: {\"questions\":[{\"question\":string,\"choices\":[string,string,string,string],\"answerIndex\":number,\"explanation\":string}]}. Each question must have exactly 4 choices and answerIndex must be 0-3.",
        },
        {
          role: "user",
          content: `Create ${data.count} quiz questions from the document titled "${doc.title}". Return ONLY the JSON.\n\n${trimDoc(doc.content)}`,
        },
      ],
    });

    const parsed = parseJson<{ questions: QuizQuestion[] }>(raw);
    if (!parsed?.questions?.length) throw new Error("AI did not return valid quiz questions.");

    const { data: row, error: iErr } = await context.supabase
      .from("quizzes")
      .insert({ document_id: data.documentId, user_id: context.userId, questions: parsed.questions })
      .select("id, questions, created_at")
      .single();
    if (iErr) throw new Error(iErr.message);
    return row;
  });

export type Flashcard = { front: string; back: string };

export const getLatestDeck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("flashcard_decks")
      .select("id, cards, created_at")
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ documentId: uuid, count: z.number().int().min(4).max(30).default(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("title, content")
      .eq("id", data.documentId)
      .single();
    if (error) throw new Error(error.message);

    const { callAI, trimDoc } = await import("@/lib/ai.server");
    const raw = await callAI({
      messages: [
        {
          role: "system",
          content:
            "You create study flashcards. Reply with strict JSON only: {\"cards\":[{\"front\":string,\"back\":string}]}. Front is a short question or term; back is a concise answer.",
        },
        {
          role: "user",
          content: `Create ${data.count} flashcards from the document titled "${doc.title}". Return ONLY the JSON.\n\n${trimDoc(doc.content)}`,
        },
      ],
    });

    const parsed = parseJson<{ cards: Flashcard[] }>(raw);
    if (!parsed?.cards?.length) throw new Error("AI did not return valid flashcards.");

    const { data: row, error: iErr } = await context.supabase
      .from("flashcard_decks")
      .insert({ document_id: data.documentId, user_id: context.userId, cards: parsed.cards })
      .select("id, cards, created_at")
      .single();
    if (iErr) throw new Error(iErr.message);
    return row;
  });

// Best-effort JSON extraction — models sometimes wrap JSON in code fences.
function parseJson<T>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
