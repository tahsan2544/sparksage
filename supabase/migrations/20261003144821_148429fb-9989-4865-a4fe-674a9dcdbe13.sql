ALTER TABLE public.documents
  ADD COLUMN kind text NOT NULL DEFAULT 'notes',
  ADD COLUMN subject text,
  ADD COLUMN topic text,
  ADD COLUMN author text,
  ADD COLUMN details text;
CREATE INDEX IF NOT EXISTS documents_user_subject_idx ON public.documents(user_id, subject);