-- Migration: Adicionar auditoria para RPC vincular_email_manual
-- Criado: 2026-07-14
-- Objetivo: Registrar quem vinculou cada e-mail manualmente

-- Tabela de auditoria para operações sensíveis
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao TEXT NOT NULL, -- 'email_vinculado_manual', etc
  usuario_id UUID NOT NULL REFERENCES public.usuarios_internos(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  email_id UUID,
  dados_antigos JSONB,
  dados_novos JSONB,
  motivo TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS na tabela de auditoria (admin only)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_read"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "audit_log_system_write"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true); -- RPC com SECURITY DEFINER escreve como sistema

-- Índices para performance
CREATE INDEX audit_log_usuario_id_idx ON public.audit_log(usuario_id);
CREATE INDEX audit_log_projeto_id_idx ON public.audit_log(projeto_id);
CREATE INDEX audit_log_acao_idx ON public.audit_log(acao);
CREATE INDEX audit_log_criado_em_idx ON public.audit_log(criado_em DESC);

-- Atualizar RPC vincular_email_manual para registrar auditoria
CREATE OR REPLACE FUNCTION public.vincular_email_manual(_pendente_id UUID, _projeto_id UUID)
RETURNS emails_vinculados
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.emails_nao_vinculados;
  novo public.emails_vinculados;
  _user_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular manualmente';
  END IF;

  _user_id := auth.uid();
  SELECT * INTO p FROM public.emails_nao_vinculados WHERE id = _pendente_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendente não encontrado'; END IF;

  INSERT INTO public.emails_vinculados
    (projeto_id, remetente_original, assunto, corpo_texto, data_email_original, anexos_referenciados, message_id, dedup_hash)
  VALUES
    (_projeto_id, p.remetente_original, p.assunto, p.corpo_texto, p.data_email_original, p.anexos_referenciados, p.message_id, p.dedup_hash)
  ON CONFLICT (projeto_id, dedup_hash) DO UPDATE SET assunto = EXCLUDED.assunto
  RETURNING * INTO novo;

  UPDATE public.emails_nao_vinculados SET resolvido = true WHERE id = _pendente_id;

  -- Registrar auditoria
  INSERT INTO public.audit_log (acao, usuario_id, projeto_id, email_id, dados_novos, motivo)
  VALUES (
    'email_vinculado_manual',
    _user_id,
    _projeto_id,
    novo.id,
    jsonb_build_object(
      'remetente', p.remetente_original,
      'assunto', p.assunto,
      'dedup_hash', p.dedup_hash
    ),
    'Vinculação manual da fila de revisão'
  );

  RETURN novo;
END; $$;
