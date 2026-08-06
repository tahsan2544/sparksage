/**
 * Document Studio — everything SparkSage can generate from an open document
 * beyond the summary/quiz/flashcards: audio overview, video overview, mind map,
 * written reports, slide decks, infographics and data tables.
 *
 * Results are cached in `document_artifacts` (one row per document + kind +
 * variant) so a student can come back to them without paying for a re-run.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const ARTIFACT_KINDS = [
  "audio",
  "video",
  "mindmap",
  "report",
  "slides",
  "infographic",
  "table",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const REPORT_VARIANTS = ["study_guide", "briefing", "faq", "timeline"] as const;
export type ReportVariant = (typeof REPORT_VARIANTS)[number];

// ---------- Shapes returned to the UI ----------

export interface AudioOverview {
  title: string;
  turns: Array<{ speaker: string; text: string; audio: string | null }>;
}
export interface VideoOverview {
  title: string;
  slides: Array<{ title: string; bullets: string[]; narration: string; audio: string | null; image: string | null }>;
}
export interface MindMapNode {
  label: string;
  detail?: string;
  children?: MindMapNode[];
}
export interface ReportDoc {
  title: string;
  markdown: string;
}
export interface SlideDeck {
  title: string;
  slides: Array<{ title: string; bullets: string[]; note?: string }>;
}
export interface Infographic {
  headline: string;
  subhead: string;
  stats: Array<{ value: string; label: string }>;
  sections: Array<{ title: string; points: string[] }>;
  takeaway: string;
}
export interface DataTable {
  title: string;
  columns: string[];
  rows: string[][];
}

const inputSchema = z.object({
  documentId: uuid,
  kind: z.enum(ARTIFACT_KINDS),
  variant: z.string().max(40).default(""),
  /** Optional steer, e.g. "focus on the exam-relevant formulas". */
  guidance: z.string().trim().max(600).default(""),
});

/** Read a previously generated artifact (or null). */
export const getArtifact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ documentId: uuid, kind: z.enum(ARTIFACT_KINDS), variant: z.string().max(40).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("document_artifacts")
      .select("content, updated_at")
      .eq("document_id", data.documentId)
      .eq("kind", data.kind)
      .eq("variant", data.variant)
      .maybeSingle();
    return row ?? null;
  });

/** Generate (or regenerate) one artifact for a document. */
export const generateArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("title, content")
      .eq("id", data.documentId)
      .single();
    if (error) throw new Error(error.message);

    const { personaPrompt } = await import("@/lib/persona.server");
    const { recordUsage } = await import("@/lib/limits.server");
    const persona = await personaPrompt(context.supabase, context.userId);

    const built = await build({
      kind: data.kind,
      variant: data.variant,
      guidance: data.guidance,
      title: doc.title,
      content: doc.content,
      persona,
    });

    const { error: upErr } = await context.supabase.from("document_artifacts").upsert(
      {
        document_id: data.documentId,
        user_id: context.userId,
        kind: data.kind,
        variant: data.variant,
        content: built as unknown as Record<string, unknown>,
      },
      { onConflict: "document_id,kind,variant" },
    );
    if (upErr) throw new Error(upErr.message);

    await recordUsage(context.userId, "document_studio_generations_per_day");
    return { content: built };
  });

// ---------- Generation ----------

interface BuildArgs {
  kind: ArtifactKind;
  variant: string;
  guidance: string;
  title: string;
  content: string;
  persona: string;
}

async function build(args: BuildArgs): Promise<unknown> {
  switch (args.kind) {
    case "audio":
      return buildAudio(args);
    case "video":
      return buildVideo(args);
    case "mindmap":
      return buildJson<{ root: MindMapNode }>(
        args,
        'You map documents into hierarchical mind maps. Reply with strict JSON only: {"root":{"label":string,"detail":string,"children":[{"label":string,"detail":string,"children":[...]}]}}. Use 4-7 top-level themes, each with 2-5 children, max 3 levels deep. "detail" is one short sentence.',
        `Build a mind map of the document "${args.title}".`,
      );
    case "report":
      return buildReport(args);
    case "slides":
      return buildJson<SlideDeck>(
        args,
        'You build clear teaching slide decks. Reply with strict JSON only: {"title":string,"slides":[{"title":string,"bullets":[string],"note":string}]}. Produce 8-12 slides, 3-5 short bullets each, and a one-sentence speaker note.',
        `Create a slide deck from the document "${args.title}".`,
      );
    case "infographic":
      return buildJson<Infographic>(
        args,
        'You design single-page infographics. Reply with strict JSON only: {"headline":string,"subhead":string,"stats":[{"value":string,"label":string}],"sections":[{"title":string,"points":[string]}],"takeaway":string}. Give 3-4 punchy stats (numbers, dates or counts found in the text) and 3-4 sections with 2-4 very short points.',
        `Create an infographic summary of the document "${args.title}".`,
      );
    case "table":
      return buildJson<DataTable>(
        args,
        'You extract structured data from documents. Reply with strict JSON only: {"title":string,"columns":[string],"rows":[[string]]}. Choose 3-5 columns that best fit the material (e.g. Term / Definition / Example, or Date / Event / Significance) and 6-15 rows. Every row must have exactly as many cells as there are columns.',
        `Extract a structured data table from the document "${args.title}".`,
      );
  }
}

const REPORT_META: Record<ReportVariant, { title: string; brief: string }> = {
  study_guide: {
    title: "Study guide",
    brief:
      "A complete study guide: learning objectives, key concepts with explanations, worked examples, common mistakes, and a short self-test section at the end.",
  },
  briefing: {
    title: "Briefing doc",
    brief:
      "An executive briefing: purpose, context, the main arguments or findings, supporting evidence, implications, and open questions.",
  },
  faq: {
    title: "FAQ",
    brief:
      "A frequently-asked-questions document: 10-15 questions a student would realistically ask about this material, each with a clear answer grounded in the text.",
  },
  timeline: {
    title: "Timeline",
    brief:
      "A chronological timeline of the events, stages or steps in the document, each with its date/order marker and a short description of why it matters.",
  },
};

async function buildReport(args: BuildArgs): Promise<ReportDoc> {
  const variant = (REPORT_VARIANTS as readonly string[]).includes(args.variant)
    ? (args.variant as ReportVariant)
    : "study_guide";
  const meta = REPORT_META[variant];
  const { callAI, trimDoc } = await import("@/lib/ai.server");
  const markdown = await callAI({
    model: "google/gemini-3.5-flash",
    messages: [
      {
        role: "system",
        content:
          `You write polished study reports in Markdown with clear headings, short paragraphs and lists. ${meta.brief} Ground everything in the supplied document.` +
          args.persona,
      },
      {
        role: "user",
        content: `${guidanceLine(args.guidance)}Write the ${meta.title.toLowerCase()} for the document "${args.title}".\n\n${trimDoc(args.content)}`,
      },
    ],
  });
  return { title: meta.title, markdown };
}

/** Two-voice podcast: script first, then one TTS clip per turn. */
async function buildAudio(args: BuildArgs): Promise<AudioOverview> {
  const script = await buildJson<{ title: string; turns: Array<{ speaker: string; text: string }> }>(
    args,
    'You write two-host podcast scripts (host names: "Maya" and "Leo"). Reply with strict JSON only: {"title":string,"turns":[{"speaker":"Maya"|"Leo","text":string}]}. Write 8 alternating turns starting with Maya. Each turn is 2-4 spoken sentences — natural, curious, no stage directions, no markdown.',
    `Write a podcast-style discussion that teaches the document "${args.title}".`,
  );

  const turns = script.turns.slice(0, 8);
  const { synthesizeSpeech } = await import("@/lib/ai.server");
  const withAudio = await Promise.all(
    turns.map(async (t) => {
      try {
        const audio = await synthesizeSpeech(t.text, t.speaker === "Leo" ? "onyx" : "nova");
        return { ...t, audio };
      } catch {
        return { ...t, audio: null }; // transcript still works without narration
      }
    }),
  );
  return { title: script.title || `${args.title} — audio overview`, turns: withAudio };
}

/** Narrated slide-style video: slides + per-slide narration audio + artwork. */
async function buildVideo(args: BuildArgs): Promise<VideoOverview> {
  const plan = await buildJson<{
    title: string;
    slides: Array<{ title: string; bullets: string[]; narration: string; visual: string }>;
  }>(
    args,
    'You storyboard short explainer videos. Reply with strict JSON only: {"title":string,"slides":[{"title":string,"bullets":[string],"narration":string,"visual":string}]}. Produce exactly 5 slides. "bullets" is 2-4 very short phrases, "narration" is 2-3 spoken sentences with no markdown, "visual" describes the diagram or image that should appear on that slide.',
    `Storyboard a narrated video overview of the document "${args.title}".`,
  );

  const slides = plan.slides.slice(0, 5);
  const { synthesizeSpeech, generateIllustration } = await import("@/lib/ai.server");
  const built = await Promise.all(
    slides.map(async (s) => {
      const [audio, image] = await Promise.all([
        synthesizeSpeech(s.narration, "nova").catch(() => null),
        generateIllustration(s.visual || s.title),
      ]);
      return { title: s.title, bullets: s.bullets ?? [], narration: s.narration, audio, image };
    }),
  );
  return { title: plan.title || `${args.title} — video overview`, slides: built };
}

/** Shared JSON-mode helper. */
async function buildJson<T>(args: BuildArgs, system: string, task: string): Promise<T> {
  const { callAI, trimDoc } = await import("@/lib/ai.server");
  const raw = await callAI({
    model: "google/gemini-3.5-flash",
    messages: [
      { role: "system", content: system + args.persona },
      {
        role: "user",
        content: `${guidanceLine(args.guidance)}${task} Return ONLY the JSON.\n\n${trimDoc(args.content)}`,
      },
    ],
  });
  const parsed = parseJson<T>(raw);
  if (!parsed) throw new Error("The AI response couldn't be read. Please try generating again.");
  return parsed;
}

function guidanceLine(guidance: string): string {
  return guidance.trim() ? `The student asked you to focus on: ${guidance.trim()}\n\n` : "";
}

/** Models sometimes wrap JSON in code fences — pull the object out safely. */
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
