-- 1. Pro upgrade requests
CREATE TABLE public.pro_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_plan text NOT NULL DEFAULT 'pro',
  message text,
  status text NOT NULL DEFAULT 'pending',
  owner_note text,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pro_requests TO authenticated;
GRANT ALL ON public.pro_requests TO service_role;

ALTER TABLE public.pro_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own requests read" ON public.pro_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own requests create" ON public.pro_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner manages pro requests" ON public.pro_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER pro_requests_set_updated_at
  BEFORE UPDATE ON public.pro_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One open request per student at a time
CREATE UNIQUE INDEX pro_requests_one_pending
  ON public.pro_requests (user_id) WHERE status = 'pending';

-- 2. Plan feature limits: no anonymous access
DROP POLICY IF EXISTS "visible plan features readable" ON public.plan_features;
REVOKE SELECT ON public.plan_features FROM anon;
CREATE POLICY "signed in members read visible plan features" ON public.plan_features
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_features.plan_id AND p.is_visible)
    OR public.has_role(auth.uid(), 'owner')
  );

-- 3. Hidden Enterprise plan becomes the Owner-granted Master plan
UPDATE public.plans
   SET key = 'master',
       name = 'Master',
       description = 'Everything unlimited. Granted by the platform Owner only.',
       price_cents = 0,
       is_visible = false
 WHERE key = 'enterprise';
