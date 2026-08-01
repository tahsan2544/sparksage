-- ============ Announcements ============
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  message text NOT NULL,
  button_text text,
  button_url text,
  type text NOT NULL DEFAULT 'banner',
  priority text NOT NULL DEFAULT 'normal',
  audience text NOT NULL DEFAULT 'everyone',
  is_published boolean NOT NULL DEFAULT false,
  publish_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "published announcements readable" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (
    is_published
    AND publish_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX announcements_live_idx ON public.announcements (is_published, publish_at DESC);

-- ============ Feedback ============
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'suggestion',
  subject text NOT NULL,
  message text NOT NULL,
  rating integer,
  page_url text,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'normal',
  tags text[] NOT NULL DEFAULT '{}',
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  owner_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feedback read" ON public.feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own feedback create" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner manages feedback" ON public.feedback
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX feedback_recent_idx ON public.feedback (created_at DESC);

-- ============ Full feature catalogue for every plan ============
-- (feature_key, free limit, pro limit, enterprise limit)  NULL = unlimited, 0 = disabled
WITH catalogue(feature_key, free_max, pro_max, ent_max) AS (
  VALUES
    ('pdf_upload', 5::int, NULL::int, NULL::int),
    ('max_documents', 10, 500, NULL),
    ('max_storage_mb', 100, 5000, NULL),
    ('ai_questions_per_day', 20, 500, NULL),
    ('ai_questions_per_month', 300, 10000, NULL),
    ('flashcards_per_day', 3, 50, NULL),
    ('flashcards_per_month', 30, 1000, NULL),
    ('quizzes_per_day', 3, 50, NULL),
    ('quizzes_per_month', 30, 1000, NULL),
    ('notes_per_day', 10, NULL, NULL),
    ('notes_per_month', 100, NULL, NULL),
    ('ocr', 0, NULL, NULL),
    ('voice_tutor', 0, NULL, NULL),
    ('mind_maps', 0, NULL, NULL),
    ('research_assistant', 0, NULL, NULL),
    ('citation_generator', 0, NULL, NULL),
    ('grammar_correction', 0, NULL, NULL),
    ('translation', 0, NULL, NULL),
    ('priority_ai', 0, NULL, NULL),
    ('fast_queue', 0, NULL, NULL),
    ('offline_mode', 0, NULL, NULL),
    ('cloud_backup', 0, NULL, NULL),
    ('advanced_analytics', 0, NULL, NULL),
    ('export_pdf', 0, NULL, NULL),
    ('export_docx', 0, NULL, NULL),
    ('export_markdown', NULL, NULL, NULL),
    ('image_ocr', 0, NULL, NULL),
    ('image_understanding', 0, NULL, NULL),
    ('ai_whiteboard', 0, 0, NULL),
    ('study_rooms', 0, 0, NULL)
)
INSERT INTO public.plan_features (plan_id, feature_key, max_usage, cooldown_seconds, is_visible)
SELECT p.id,
       c.feature_key,
       CASE p.key WHEN 'free' THEN c.free_max::int WHEN 'pro' THEN c.pro_max::int ELSE c.ent_max::int END,
       0,
       CASE p.key
         WHEN 'free' THEN COALESCE(c.free_max::int, 1) > 0
         WHEN 'pro' THEN COALESCE(c.pro_max::int, 1) > 0
         ELSE COALESCE(c.ent_max::int, 1) > 0
       END
FROM public.plans p
CROSS JOIN catalogue c
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_features pf
  WHERE pf.plan_id = p.id AND pf.feature_key = c.feature_key
);