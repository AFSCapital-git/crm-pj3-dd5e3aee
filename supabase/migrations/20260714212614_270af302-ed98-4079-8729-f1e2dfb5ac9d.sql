
ALTER TABLE public.insights_ia DROP CONSTRAINT IF EXISTS insights_ia_revisado_por_fkey;
ALTER TABLE public.insights_ia DROP CONSTRAINT IF EXISTS insights_ia_gerado_por_fkey;
ALTER TABLE public.insights_ia
  ADD CONSTRAINT insights_ia_revisado_por_fkey
  FOREIGN KEY (revisado_por) REFERENCES public.usuarios_internos(id) ON DELETE SET NULL;
ALTER TABLE public.insights_ia
  ADD CONSTRAINT insights_ia_gerado_por_fkey
  FOREIGN KEY (gerado_por) REFERENCES public.usuarios_internos(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';
