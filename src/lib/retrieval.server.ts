/**
 * Lightweight retrieval over a document's text.
 *
 * The document is split into overlapping passages and ranked against the
 * question with a TF-IDF-ish keyword score. This keeps answers grounded in the
 * material (and gives us real, quotable sources to show the student) without
 * needing an external vector store.
 */

export interface Passage {
  /** 1-based index used as the citation marker in answers. */
  index: number;
  text: string;
}

const CHUNK_CHARS = 1100;
const OVERLAP_CHARS = 150;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "this", "that", "these",
  "those", "as", "at", "by", "from", "how", "what", "why", "when", "which",
  "does", "do", "did", "can", "you", "me", "my", "i", "we", "us", "about",
  "explain", "tell", "please", "give", "into", "not", "so", "if", "than",
]);

/** Split raw document text into overlapping passages on paragraph boundaries. */
export function chunkDocument(content: string): string[] {
  const clean = content.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= CHUNK_CHARS) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    if (current) chunks.push(current);
    if (para.length <= CHUNK_CHARS) {
      // Carry a little overlap so a concept split across chunks stays findable.
      const tail = current.slice(-OVERLAP_CHARS);
      current = tail ? `${tail}\n\n${para}` : para;
    } else {
      for (let i = 0; i < para.length; i += CHUNK_CHARS - OVERLAP_CHARS) {
        chunks.push(para.slice(i, i + CHUNK_CHARS));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Return the passages most relevant to `question`, best first.
 * Falls back to the opening passages when nothing matches, so the model always
 * has some context to work with.
 */
export function retrievePassages(content: string, question: string, limit = 6): Passage[] {
  const chunks = chunkDocument(content);
  if (chunks.length === 0) return [];
  if (chunks.length <= limit) return chunks.map((text, i) => ({ index: i + 1, text }));

  const queryTerms = new Set(tokenize(question));
  if (queryTerms.size === 0) {
    return chunks.slice(0, limit).map((text, i) => ({ index: i + 1, text }));
  }

  // Document frequency, so common words across the whole document count less.
  const docFreq = new Map<string, number>();
  const chunkTokens = chunks.map((c) => {
    const tokens = tokenize(c);
    for (const t of new Set(tokens)) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    return tokens;
  });

  const scored = chunks.map((text, i) => {
    const counts = new Map<string, number>();
    for (const t of chunkTokens[i]) counts.set(t, (counts.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const tf = counts.get(term) ?? 0;
      if (!tf) continue;
      const idf = Math.log(chunks.length / (1 + (docFreq.get(term) ?? 0))) + 1;
      score += (1 + Math.log(tf)) * idf;
    }
    return { text, order: i, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ index: i + 1, text: s.text }));
}

/** Build the numbered source block that gets injected into the system prompt. */
export function formatSources(passages: Passage[]): string {
  return passages.map((p) => `[${p.index}] ${p.text}`).join("\n\n");
}

/** A short, UI-friendly excerpt for each source shown under an answer. */
export function sourceExcerpts(passages: Passage[]): Array<{ index: number; excerpt: string }> {
  return passages.map((p) => ({
    index: p.index,
    excerpt: p.text.replace(/\s+/g, " ").slice(0, 220).trim() + (p.text.length > 220 ? "…" : ""),
  }));
}
