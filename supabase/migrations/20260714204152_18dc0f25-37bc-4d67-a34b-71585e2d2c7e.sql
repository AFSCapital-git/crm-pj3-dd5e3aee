
-- Enum de tipo de documento
CREATE TYPE public.tipo_documento AS ENUM ('material','contrato','aditivo','relatorio','outro');

-- Tabela de documentos (uma linha por versão)
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  grupo_documento_id UUID NOT NULL,
  tipo public.tipo_documento NOT NULL,
  nome_arquivo TEXT NOT NULL,
  numero_versao INT NOT NULL CHECK (numero_versao >= 1),
  storage_path TEXT NOT NULL,
  tamanho_arquivo BIGINT NOT NULL,
  mime_type TEXT,
  enviado_por UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  descricao_da_versao TEXT NOT NULL DEFAULT '',
  e_versao_atual BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grupo_documento_id, numero_versao)
);

-- Índice: garante 1 versão atual por grupo
CREATE UNIQUE INDEX documentos_versao_atual_uniq
  ON public.documentos(grupo_documento_id) WHERE e_versao_atual;

CREATE INDEX documentos_projeto_tipo_idx
  ON public.documentos(projeto_id, tipo, criado_em DESC);

CREATE INDEX documentos_grupo_idx
  ON public.documentos(grupo_documento_id, numero_versao DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

-- RLS
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documentos: leitura por escopo do projeto"
  ON public.documentos FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "Documentos: inserir por escopo do projeto"
  ON public.documentos FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "Documentos: atualizar por escopo do projeto"
  ON public.documentos FOR UPDATE TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()))
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "Documentos: admin remove"
  ON public.documentos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- RPC atômica: registra nova versão de um grupo existente
-- DEPRECATED: Esta versão do RPC foi consolidada com a versão mais completa
-- em 20260714205114_b7dca12e-6aec-4497-9ad9-7d8bf652c1a7.sql
-- que suporta tanto projeto quanto empresa.
-- Esta função foi removida. Use a versão em 20260714205114 que aceita projeto OU empresa.

-- Trigger de auditoria: cada upload vira registro na linha do tempo
CREATE OR REPLACE FUNCTION public.tg_audit_documentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
  VALUES (
    NEW.projeto_id, auth.uid(), 'nota',
    format('Documento "%s" — versão %s enviada%s',
      NEW.nome_arquivo,
      NEW.numero_versao,
      CASE WHEN COALESCE(NEW.descricao_da_versao,'') = '' THEN '' ELSE ': ' || NEW.descricao_da_versao END
    )
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_documentos
  AFTER INSERT ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_documentos();

-- ============================================================
-- Storage policies para o bucket 'documentos-projetos'
-- Estrutura de path: {projeto_id}/{grupo_documento_id}/v{n}-{nome}
-- ============================================================

CREATE POLICY "Docs storage: leitura por escopo do projeto"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-projetos'
    AND public.projeto_no_escopo(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Docs storage: upload por escopo do projeto"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-projetos'
    AND public.projeto_no_escopo(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Docs storage: update por escopo do projeto"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos-projetos'
    AND public.projeto_no_escopo(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Docs storage: admin remove"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-projetos'
    AND public.is_admin(auth.uid())
  );
