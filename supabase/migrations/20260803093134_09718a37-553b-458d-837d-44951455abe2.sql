DROP POLICY IF EXISTS "plan features readable" ON public.plan_features;

CREATE POLICY "visible plan features readable" ON public.plan_features
FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_features.plan_id AND p.is_visible)
  OR public.has_role(auth.uid(), 'owner'::app_role)
);

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_defaults() FROM PUBLIC, anon, authenticated;