CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own usage" ON public.usage_events
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX usage_events_user_feature_time_idx
  ON public.usage_events (user_id, feature_key, created_at DESC);