
CREATE TYPE public.tipo_insight_ia AS ENUM ('alerta_risco','sugestao','rascunho_relatorio');

CREATE TABLE public.insights_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  tipo public.tipo_insight_ia NOT NULL,
  titulo TEXT,
  conteudo_gerado TEXT NOT NULL,
  modelo TEXT,
  input_resumo JSONB,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  gerado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_por_humano BOOLEAN NOT NULL DEFAULT false,
  aprovado BOOLEAN NOT NULL DEFAULT false,
  revisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX insights_ia_projeto_idx ON public.insights_ia(projeto_id);
CREATE INDEX insights_ia_tipo_idx ON public.insights_ia(tipo);
CREATE INDEX insights_ia_gerado_em_idx ON public.insights_ia(gerado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights_ia TO authenticated;
GRANT ALL ON public.insights_ia TO service_role;

ALTER TABLE public.insights_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam todos os insights"
  ON public.insights_ia FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Consultores visualizam insights no escopo"
  ON public.insights_ia FOR SELECT
  TO authenticated
  USING (
    projeto_id IS NULL
    OR public.projeto_no_escopo(projeto_id, auth.uid())
  );

CREATE POLICY "Consultores inserem insights no escopo"
  ON public.insights_ia FOR INSERT
  TO authenticated
  WITH CHECK (
    projeto_id IS NULL
    OR public.projeto_no_escopo(projeto_id, auth.uid())
  );

CREATE POLICY "Consultores atualizam insights no escopo (revisão)"
  ON public.insights_ia FOR UPDATE
  TO authenticated
  USING (
    projeto_id IS NULL
    OR public.projeto_no_escopo(projeto_id, auth.uid())
  )
  WITH CHECK (
    projeto_id IS NULL
    OR public.projeto_no_escopo(projeto_id, auth.uid())
  );

CREATE TRIGGER insights_ia_updated_at
  BEFORE UPDATE ON public.insights_ia
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
