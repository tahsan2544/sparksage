CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  group_name text NOT NULL DEFAULT 'general',
  label text NOT NULL,
  description text,
  value_type text NOT NULL DEFAULT 'text',
  is_private boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public settings readable" ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (is_private = false);

CREATE POLICY "owner reads all settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "owner manages settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_app_settings_group ON public.app_settings (group_name, sort_order);

INSERT INTO public.app_settings (key, value, group_name, label, description, value_type, is_private, sort_order) VALUES
  ('app_name', 'SparkSage', 'branding', 'App name', 'Shown in the header, titles and emails.', 'text', false, 1),
  ('app_tagline', 'Study Smarter, Not Harder.', 'branding', 'Tagline', 'Hero headline on the landing page.', 'text', false, 2),
  ('app_subheading', 'Upload your notes, books, or slides and let AI help you learn faster with summaries, quizzes, flashcards, and personalized explanations.', 'branding', 'Hero subheading', 'Supporting text under the hero headline.', 'textarea', false, 3),
  ('logo_url', '', 'branding', 'Logo URL', 'Optional custom logo image.', 'text', false, 4),
  ('default_theme', 'system', 'branding', 'Default theme', 'light, dark or system.', 'text', false, 5),
  ('maintenance_mode', 'false', 'general', 'Maintenance mode', 'Show a maintenance notice to all visitors.', 'boolean', false, 1),
  ('default_language', 'en', 'general', 'Default language', 'Two letter language code.', 'text', false, 2),
  ('registration_enabled', 'true', 'auth', 'Registration enabled', 'Allow new sign ups.', 'boolean', false, 1),
  ('email_login_enabled', 'true', 'auth', 'Email login enabled', 'Allow email and password sign in.', 'boolean', false, 2),
  ('google_login_enabled', 'true', 'auth', 'Google login enabled', 'Show the Continue with Google button.', 'boolean', false, 3),
  ('max_upload_mb', '20', 'uploads', 'Maximum upload size (MB)', 'Largest file a student can upload.', 'number', false, 1),
  ('allowed_file_types', 'pdf,docx,pptx,txt', 'uploads', 'Allowed file types', 'Comma separated list of extensions.', 'text', false, 2),
  ('max_ocr_pages', '50', 'uploads', 'Maximum OCR pages', 'Page cap for scanned documents.', 'number', false, 3),
  ('default_ai_model', 'google/gemini-3.5-flash', 'ai', 'Default AI model', 'Model used for tutoring and generation.', 'text', false, 1),
  ('support_email', 'support@sparksage.app', 'contact', 'Support email', 'Where students can reach you.', 'text', false, 1),
  ('privacy_url', '/privacy', 'contact', 'Privacy policy URL', 'Linked in the footer.', 'text', false, 2),
  ('terms_url', '/terms', 'contact', 'Terms URL', 'Linked in the footer.', 'text', false, 3),
  ('announcement', '', 'general', 'Announcement banner', 'Optional message shown across the app.', 'text', false, 3);