
-- 1. Enum novo para diferenciar e-mail encaminhado de interação manual
ALTER TYPE public.tipo_interacao ADD VALUE IF NOT EXISTS 'email_encaminhado';

-- 2. Função geradora de código de rastreio
CREATE OR REPLACE FUNCTION public.gen_codigo_rastreio()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := 'PRJ-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.projetos WHERE codigo_rastreio = code);
    attempts := attempts + 1;
    IF attempts > 20 THEN
      code := 'PRJ-' || upper(substr(md5(random()::text), 1, 6));
      EXIT;
    END IF;
  END LOOP;
  RETURN code;
END; $$;

-- 3. Coluna codigo_rastreio em projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT;

-- Backfill dos existentes
UPDATE public.projetos SET codigo_rastreio = public.gen_codigo_rastreio() WHERE codigo_rastreio IS NULL;

ALTER TABLE public.projetos ALTER COLUMN codigo_rastreio SET NOT NULL;
ALTER TABLE public.projetos ADD CONSTRAINT projetos_codigo_rastreio_key UNIQUE (codigo_rastreio);

-- Trigger para atribuir na criação
CREATE OR REPLACE FUNCTION public.tg_projetos_codigo_rastreio()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    NEW.codigo_rastreio := public.gen_codigo_rastreio();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_projetos_codigo_rastreio ON public.projetos;
CREATE TRIGGER trg_projetos_codigo_rastreio
BEFORE INSERT ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.tg_projetos_codigo_rastreio();

-- 4. Tabela emails_vinculados
CREATE TABLE public.emails_vinculados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  remetente_original TEXT NOT NULL,
  assunto TEXT,
  corpo_texto TEXT,
  data_email_original TIMESTAMPTZ,
  anexos_referenciados JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_id TEXT,
  dedup_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX emails_vinculados_dedup_uidx ON public.emails_vinculados (projeto_id, dedup_hash);
CREATE INDEX emails_vinculados_projeto_idx ON public.emails_vinculados (projeto_id, data_email_original DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails_vinculados TO authenticated;
GRANT ALL ON public.emails_vinculados TO service_role;

ALTER TABLE public.emails_vinculados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emails_vinculados_select_escopo"
  ON public.emails_vinculados FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "emails_vinculados_admin_manage"
  ON public.emails_vinculados FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Tabela emails_nao_vinculados
CREATE TABLE public.emails_nao_vinculados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_original TEXT NOT NULL,
  assunto TEXT,
  corpo_texto TEXT,
  data_email_original TIMESTAMPTZ,
  anexos_referenciados JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_id TEXT,
  dedup_hash TEXT NOT NULL UNIQUE,
  motivo TEXT NOT NULL DEFAULT 'codigo_ausente',
  resolvido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX emails_nao_vinculados_pendentes_idx ON public.emails_nao_vinculados (resolvido, criado_em DESC);

GRANT SELECT ON public.emails_nao_vinculados TO authenticated;
GRANT ALL ON public.emails_nao_vinculados TO service_role;

ALTER TABLE public.emails_nao_vinculados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emails_nao_vinculados_admin_read"
  ON public.emails_nao_vinculados FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "emails_nao_vinculados_admin_manage"
  ON public.emails_nao_vinculados FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Trigger: registro na timeline do projeto
CREATE OR REPLACE FUNCTION public.tg_emails_vinculados_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, data_hora)
  VALUES (
    NEW.projeto_id,
    NULL,
    'email_encaminhado',
    format('E-mail de %s%s',
      NEW.remetente_original,
      CASE WHEN COALESCE(NEW.assunto,'') = '' THEN '' ELSE ' — "' || NEW.assunto || '"' END
    ),
    COALESCE(NEW.data_email_original, NEW.criado_em)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_emails_vinculados_timeline
AFTER INSERT ON public.emails_vinculados
FOR EACH ROW EXECUTE FUNCTION public.tg_emails_vinculados_timeline();

-- 7. RPC para vincular manualmente da fila
CREATE OR REPLACE FUNCTION public.vincular_email_manual(_pendente_id UUID, _projeto_id UUID)
RETURNS emails_vinculados
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.emails_nao_vinculados;
  novo public.emails_vinculados;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular manualmente';
  END IF;
  SELECT * INTO p FROM public.emails_nao_vinculados WHERE id = _pendente_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendente não encontrado'; END IF;

  INSERT INTO public.emails_vinculados
    (projeto_id, remetente_original, assunto, corpo_texto, data_email_original, anexos_referenciados, message_id, dedup_hash)
  VALUES
    (_projeto_id, p.remetente_original, p.assunto, p.corpo_texto, p.data_email_original, p.anexos_referenciados, p.message_id, p.dedup_hash)
  ON CONFLICT (projeto_id, dedup_hash) DO UPDATE SET assunto = EXCLUDED.assunto
  RETURNING * INTO novo;

  UPDATE public.emails_nao_vinculados SET resolvido = true WHERE id = _pendente_id;
  RETURN novo;
END; $$;
