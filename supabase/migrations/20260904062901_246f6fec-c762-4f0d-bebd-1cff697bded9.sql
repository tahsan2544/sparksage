CREATE TABLE public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  total int not null check (total > 0),
  correct int not null check (correct >= 0),
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quiz attempts" ON public.quiz_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX quiz_attempts_user_created_idx ON public.quiz_attempts(user_id, created_at DESC);

CREATE TABLE public.concept_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  topic text not null,
  source text not null default 'quiz',
  attempts int not null default 0,
  correct int not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, document_id, topic)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concept_performance TO authenticated;
GRANT ALL ON public.concept_performance TO service_role;
ALTER TABLE public.concept_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own concept performance" ON public.concept_performance FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX concept_performance_user_idx ON public.concept_performance(user_id, last_seen_at DESC);