// Server functions for the general-purpose "Chat with SparkSage AI" tutor.
// Unlike the per-document chat, this one is not tied to a document: the whole
// conversation (plus any attached files) is sent from the client each turn.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageOrPdfDataUrl } from "@/lib/data-url";

/** An attachment forwarded from the browser as a base64 data URL. */
const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  /** `data:<mime>;base64,...` — omitted for files we cannot send to the model. */
  dataUrl: imageOrPdfDataUrl(14_000_000).optional(),
  kind: z.enum(["image", "document", "video", "other"]),
});

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20_000),
});

const inputSchema = z.object({
  message: z.string().trim().max(8_000),
  history: z.array(turnSchema).max(40).default([]),
  attachments: z.array(attachmentSchema).max(6).default([]),
  /** Optional study space: answer from these uploaded documents. */
  documentIds: z.array(z.string().uuid()).max(10).default([]),
});

const SYSTEM_PROMPT = `You are SparkSage AI, a warm and encouraging study tutor.
Explain clearly and step by step, use short paragraphs and bullet points, and
finish with a quick check-for-understanding question when it helps.
If the student attaches files, base your answer on them. SparkSage is a
cloud service, so always assume the student is online.`;

/**
 * Ask the tutor a question, optionally with attached images/documents.
 * Images and PDFs are passed to the model inline; videos and unsupported
 * formats are described by name so the model can respond sensibly.
 */
export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.message && data.attachments.length === 0) {
      throw new Error("Write a message or attach a file first.");
    }

    const { enforceLimit, recordUsage } = await import("@/lib/limits.server");
    await enforceLimit(context.supabase, context.userId, "ai_chat_messages_per_day");

    // Study space: pull the relevant passages out of the selected documents so
    // the tutor answers from the student's own material and can show sources.
    let grounding = "";
    let sources: Array<{ index: number; documentTitle: string; excerpt: string }> = [];
    if (data.documentIds.length > 0) {
      const { retrieve, STRICT_GROUNDING_RULES } = await import("@/lib/rag.server");
      const query = data.message || data.history.filter((m) => m.role === "user").at(-1)?.content || "";
      const hits = await retrieve(context.supabase, context.userId, data.documentIds, query, 8);
      sources = hits.map(({ index, documentTitle, excerpt }) => ({ index, documentTitle, excerpt }));
      if (hits.length === 0) {
        // Nothing relevant: answer without calling the model so it can't guess.
        await recordUsage(context.userId, "ai_chat_messages_per_day");
        return {
          answer:
            "That isn't covered in your selected materials. Try rephrasing with terms from your notes, select another document, or upload material on this topic.",
          sources,
        };
      }
      grounding = `\n\n${STRICT_GROUNDING_RULES}\n\nEXCERPTS\n${hits
        .map((h) => `[${h.index}] (${h.documentTitle}) ${h.text}`)
        .join("\n\n")}`;
    }

    const { callAI } = await import("@/lib/ai.server");
    const parts: import("@/lib/ai.server").ContentPart[] = [];

    const unsupported: string[] = [];
    for (const file of data.attachments) {
      if (file.kind === "image" && file.dataUrl?.startsWith("data:image/")) {
        parts.push({ type: "image_url", image_url: { url: file.dataUrl } });
      } else if (file.kind === "document" && file.dataUrl?.startsWith("data:application/pdf;")) {
        parts.push({ type: "file", file: { filename: file.name, file_data: file.dataUrl } });
      } else {
        unsupported.push(`${file.name} (${file.mime})`);
      }
    }

    const text = [
      data.message || "Please look at the attached files and help me study them.",
      unsupported.length
        ? `\n\n(The student also attached: ${unsupported.join(", ")}. You cannot view these directly — ask them for the key details or a text/image version.)`
        : "",
    ].join("");
    parts.unshift({ type: "text", text });

    // Student's saved tone / style / language preferences are appended to every prompt.
    const { personaPrompt } = await import("@/lib/persona.server");
    const persona = await personaPrompt(context.supabase, context.userId);

    const answer = await callAI({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + grounding + persona },
        ...data.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: parts },
      ],
    });


    await recordUsage(context.userId, "ai_chat_messages_per_day");
    return { answer, sources };
  });
