CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(3072),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their chunks" ON public.document_chunks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX document_chunks_doc_idx ON public.document_chunks(document_id);
CREATE INDEX document_chunks_tsv_idx ON public.document_chunks USING gin(tsv);

-- Hybrid retrieval: semantic similarity + keyword rank. SECURITY INVOKER so RLS applies.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  p_document_ids uuid[], p_query text, p_embedding text, p_limit int DEFAULT 8
) RETURNS TABLE(id uuid, document_id uuid, chunk_index int, content text, similarity float, keyword_rank float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  SELECT c.id, c.document_id, c.chunk_index, c.content,
    CASE WHEN p_embedding IS NULL OR c.embedding IS NULL THEN 0
         ELSE 1 - (c.embedding <=> p_embedding::extensions.vector) END AS similarity,
    ts_rank(c.tsv, websearch_to_tsquery('english', p_query))::float AS keyword_rank
  FROM public.document_chunks c
  WHERE c.document_id = ANY(p_document_ids)
  ORDER BY (CASE WHEN p_embedding IS NULL OR c.embedding IS NULL THEN 0
         ELSE 1 - (c.embedding <=> p_embedding::extensions.vector) END)
         + 0.5 * ts_rank(c.tsv, websearch_to_tsquery('english', p_query)) DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid[], text, text, int) TO authenticated;