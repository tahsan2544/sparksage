-- 1. Per-user preferences: AI personalization + focus timer settings
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_tone text NOT NULL DEFAULT 'friendly',
  ai_style text NOT NULL DEFAULT 'balanced',
  ai_language text NOT NULL DEFAULT 'English',
  ai_instructions text NOT NULL DEFAULT '',
  focus_minutes integer NOT NULL DEFAULT 25,
  short_break_minutes integer NOT NULL DEFAULT 5,
  long_break_minutes integer NOT NULL DEFAULT 15,
  sessions_before_long_break integer NOT NULL DEFAULT 4,
  sound_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Generated study artifacts for a document (audio/video/mind map/reports/slides/infographic/table)
CREATE TABLE public.document_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  variant text NOT NULL DEFAULT '',
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, kind, variant)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_artifacts TO authenticated;
GRANT ALL ON public.document_artifacts TO service_role;
ALTER TABLE public.document_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifacts" ON public.document_artifacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER document_artifacts_set_updated_at BEFORE UPDATE ON public.document_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX document_artifacts_document_idx ON public.document_artifacts(document_id);

-- 3. Remove the manual upgrade-request system entirely
DROP TABLE IF EXISTS public.pro_requests;