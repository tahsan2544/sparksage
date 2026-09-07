CREATE TABLE public.exam_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject TEXT NOT NULL,
  exam_date DATE NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}',
  minutes_per_day INT NOT NULL DEFAULT 60,
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_plans TO authenticated;
GRANT ALL ON public.exam_plans TO service_role;
ALTER TABLE public.exam_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own exam plans" ON public.exam_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX exam_plans_user_date_idx ON public.exam_plans (user_id, exam_date);