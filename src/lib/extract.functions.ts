/**
 * Server helper for reading text out of images (photos of notes, scanned
 * pages). Runs through the AI gateway because OCR needs a vision model.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  /** `data:image/...;base64,...` — capped so payloads stay small. */
  dataUrl: z.string().max(7_000_000),
});

/** Transcribe an image into plain study text. Counts against the AI quota. */
export const readImageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { enforceLimit, recordUsage } = await import("@/lib/limits.server");
    await enforceLimit(context.supabase, context.userId, "ai_chat_messages_per_day");

    const { callAI } = await import("@/lib/ai.server");
    const text = await callAI({
      model: "google/gemini-3.6-flash",
      messages: [
        {
          role: "system",
          content:
            "You transcribe study material from images. Return only the text you can read, keeping headings and " +
            "lists. If the image has no readable text, describe it in two sentences instead.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Transcribe this file: ${data.fileName}` },
            { type: "image_url", image_url: { url: data.dataUrl } },
          ],
        },
      ],
    });

    await recordUsage(context.userId, "ai_chat_messages_per_day");
    return { text };
  });
