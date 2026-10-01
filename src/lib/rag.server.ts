// Retrieval-augmented generation pipeline:
//  1. chunk each document into overlapping passages,
//  2. embed passages with the AI gateway and store them in `document_chunks`,
//  3. at question time, embed the query and run hybrid (semantic + keyword)
//     search across the selected documents, returning numbered sources.
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkDocument } from "@/lib/retrieval.server";

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "google/gemini-embedding-2";
const BATCH = 32;
/** Results scoring below this are treated as "not covered by your materials". */
const MIN_SCORE = 0.35;

export async function embed(texts: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace billing settings.");
    if (!res.ok) throw new Error(`Embedding failed (${res.status}).`);
    const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

/** (Re)build the passage index for one document. */
export async function indexDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  content: string,
): Promise<number> {
  const chunks = chunkDocument(content ?? "").slice(0, 400);
  await supabase.from("document_chunks").delete().eq("document_id", documentId);
  if (chunks.length === 0) return 0;
  const vectors = await embed(chunks);
  const rows = chunks.map((text, i) => ({
    document_id: documentId,
    user_id: userId,
    chunk_index: i,
    content: text,
    embedding: JSON.stringify(vectors[i]),
  }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + 50) as never);
    if (error) throw new Error(error.message);
  }
  return chunks.length;
}

/** Index any selected documents that have not been indexed yet. */
async function ensureIndexed(supabase: SupabaseClient, userId: string, documentIds: string[]) {
  const { data: existing } = await supabase
    .from("document_chunks")
    .select("document_id")
    .in("document_id", documentIds)
    .eq("chunk_index", 0);
  const done = new Set((existing ?? []).map((r: { document_id: string }) => r.document_id));
  const missing = documentIds.filter((id) => !done.has(id));
  if (missing.length === 0) return;
  const { data: docs } = await supabase.from("documents").select("id, content").in("id", missing);
  for (const d of (docs ?? []) as Array<{ id: string; content: string | null }>) {
    await indexDocument(supabase, userId, d.id, d.content ?? "");
  }
}

export interface RagSource {
  index: number;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  text: string;
  score: number;
}

/** Hybrid search across the given documents. Only confident matches are returned. */
export async function retrieve(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
  question: string,
  limit = 8,
): Promise<RagSource[]> {
  if (documentIds.length === 0 || !question.trim()) return [];
  await ensureIndexed(supabase, userId, documentIds);
  const [qVec] = await embed([question]);
  const { data, error } = await supabase.rpc("match_document_chunks" as never, {
    p_document_ids: documentIds,
    p_query: question,
    p_embedding: JSON.stringify(qVec),
    p_limit: limit,
  } as never);
  if (error) throw new Error((error as { message: string }).message);
  const rows = (data ?? []) as Array<{
    document_id: string; content: string; similarity: number; keyword_rank: number;
  }>;
  const { data: docs } = await supabase.from("documents").select("id, title").in("id", documentIds);
  const titles = new Map(((docs ?? []) as Array<{ id: string; title: string }>).map((d) => [d.id, d.title]));
  return rows
    .map((r) => ({ ...r, score: r.similarity + 0.5 * r.keyword_rank }))
    .filter((r) => r.score >= MIN_SCORE)
    .map((r, i) => ({
      index: i + 1,
      documentId: r.document_id,
      documentTitle: titles.get(r.document_id) ?? "Document",
      text: r.content,
      score: Number(r.score.toFixed(3)),
      excerpt: r.content.replace(/\s+/g, " ").slice(0, 220).trim() + (r.content.length > 220 ? "…" : ""),
    }));
}

export const STRICT_GROUNDING_RULES = `STRICT GROUNDING RULES
- Answer ONLY from the numbered excerpts below, taken from the student's own materials.
- Cite every claim inline like [1] or [2]. Never cite a number that is not listed.
- If the excerpts do not contain the answer, reply exactly: "That isn't covered in your selected materials." and suggest what to upload or ask instead. Do NOT fill gaps with outside knowledge.
- Never invent quotes, numbers, names or page references.`;
