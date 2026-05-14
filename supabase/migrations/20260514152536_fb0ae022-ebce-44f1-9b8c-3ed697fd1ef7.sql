
CREATE TABLE public.wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  module_key text,
  content_md text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wiki_pages_parent ON public.wiki_pages(parent_id);
CREATE INDEX idx_wiki_pages_module ON public.wiki_pages(module_key);

ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read wiki" ON public.wiki_pages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "TA master manages wiki" ON public.wiki_pages
  FOR ALL TO authenticated
  USING (public.is_ta_master(auth.uid()))
  WITH CHECK (public.is_ta_master(auth.uid()));

CREATE TRIGGER trg_wiki_pages_updated_at
  BEFORE UPDATE ON public.wiki_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
