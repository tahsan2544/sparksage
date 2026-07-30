-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('owner', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner reads all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "owner manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Only one owner may ever exist.
CREATE UNIQUE INDEX one_owner_only ON public.user_roles ((role)) WHERE role = 'owner';

-- PLANS ---------------------------------------------------------------
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visible plans readable" ON public.plans
  FOR SELECT TO authenticated, anon USING (is_visible OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "owner manages plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PLAN FEATURE LIMITS -------------------------------------------------
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  max_usage integer,
  cooldown_seconds integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

GRANT SELECT ON public.plan_features TO authenticated, anon;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan features readable" ON public.plan_features
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "owner manages plan features" ON public.plan_features
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER plan_features_set_updated_at BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUBSCRIPTIONS -------------------------------------------------------
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner manages subscriptions" ON public.user_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER user_subscriptions_set_updated_at BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED PLANS ----------------------------------------------------------
INSERT INTO public.plans (key, name, description, price_cents, sort_order, is_visible) VALUES
  ('free', 'Free', 'Everything you need to start studying smarter.', 0, 1, true),
  ('pro', 'Pro', 'Unlimited AI study power for serious learners.', 900, 2, true),
  ('enterprise', 'Enterprise', 'For schools and teams.', 0, 3, false);

INSERT INTO public.plan_features (plan_id, feature_key, max_usage, cooldown_seconds, is_visible)
SELECT p.id, f.feature_key, f.max_usage, f.cooldown_seconds, f.is_visible
FROM public.plans p
JOIN (VALUES
  ('free', 'documents', 5, 0, true),
  ('free', 'ai_chat_messages_per_day', 25, 0, true),
  ('free', 'quiz_generations_per_day', 3, 0, true),
  ('free', 'flashcard_generations_per_day', 3, 0, true),
  ('free', 'summaries_per_day', 3, 0, true),
  ('pro', 'documents', NULL, 0, true),
  ('pro', 'ai_chat_messages_per_day', NULL, 0, true),
  ('pro', 'quiz_generations_per_day', NULL, 0, true),
  ('pro', 'flashcard_generations_per_day', NULL, 0, true),
  ('pro', 'summaries_per_day', NULL, 0, true),
  ('enterprise', 'documents', NULL, 0, true),
  ('enterprise', 'ai_chat_messages_per_day', NULL, 0, true),
  ('enterprise', 'quiz_generations_per_day', NULL, 0, true),
  ('enterprise', 'flashcard_generations_per_day', NULL, 0, true),
  ('enterprise', 'summaries_per_day', NULL, 0, true)
) AS f(plan_key, feature_key, max_usage, cooldown_seconds, is_visible)
  ON f.plan_key = p.key;

-- Give every existing and future account the default role + free plan.
CREATE OR REPLACE FUNCTION public.handle_new_user_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_subscriptions (user_id, plan_id)
    SELECT NEW.id, id FROM public.plans WHERE key = 'free'
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.handle_new_user_defaults() FROM public;

CREATE TRIGGER on_auth_user_created_defaults
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_defaults();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users ON CONFLICT DO NOTHING;

INSERT INTO public.user_subscriptions (user_id, plan_id)
SELECT u.id, p.id FROM auth.users u CROSS JOIN public.plans p WHERE p.key = 'free'
ON CONFLICT (user_id) DO NOTHING;