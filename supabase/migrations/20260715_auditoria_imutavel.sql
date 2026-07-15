-- Auditoria imutável: impede edição de entradas automáticas na timeline

-- Adicionar coluna para marcar entradas automáticas
ALTER TABLE public.interacoes
  ADD COLUMN IF NOT EXISTS e_automatico BOOLEAN NOT NULL DEFAULT false;

-- Atualizar triggers de auditoria para marcar como automático
CREATE OR REPLACE FUNCTION public.tg_audit_projetos() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF COALESCE(NEW.valor_aprovado,-1) IS DISTINCT FROM COALESCE(OLD.valor_aprovado,-1) THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
    VALUES (NEW.id, uid, 'aditivo_contratual',
      format('Valor aprovado alterado de %s para %s',
        COALESCE(to_char(OLD.valor_aprovado,'FM999G999G990D00'),'—'),
        COALESCE(to_char(NEW.valor_aprovado,'FM999G999G990D00'),'—')),
      true);
  END IF;
  IF COALESCE(NEW.prazo_execucao_meses,-1) IS DISTINCT FROM COALESCE(OLD.prazo_execucao_meses,-1)
     OR COALESCE(NEW.data_submissao, DATE '1900-01-01') IS DISTINCT FROM COALESCE(OLD.data_submissao, DATE '1900-01-01') THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
    VALUES (NEW.id, uid, 'alteracao_cronograma',
      format('Cronograma alterado (prazo: %s meses; submissão: %s)',
        COALESCE(NEW.prazo_execucao_meses::text,'—'),
        COALESCE(NEW.data_submissao::text,'—')),
      true);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
    VALUES (NEW.id, uid, 'nota',
      format('Status alterado de "%s" para "%s"', OLD.status, NEW.status),
      true);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_audit_marcos() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF NEW.data_prevista IS DISTINCT FROM OLD.data_prevista THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
    VALUES (NEW.projeto_id, uid, 'alteracao_cronograma',
      format('Data prevista do marco "%s" alterada de %s para %s',
        NEW.tipo, OLD.data_prevista, NEW.data_prevista),
      true);
  END IF;
  IF NEW.data_entrega_real IS DISTINCT FROM OLD.data_entrega_real AND NEW.data_entrega_real IS NOT NULL THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
    VALUES (NEW.projeto_id, uid, 'nota',
      format('Marco "%s" entregue em %s (previsto: %s, %s dias %s)',
        NEW.tipo, NEW.data_entrega_real, NEW.data_prevista,
        ABS(NEW.data_entrega_real - NEW.data_prevista),
        CASE WHEN NEW.data_entrega_real > NEW.data_prevista THEN 'de atraso' ELSE 'de antecedência/no prazo' END),
      true);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_audit_documentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nome_autor TEXT;
BEGIN
  IF NEW.projeto_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT nome INTO _nome_autor FROM public.usuarios_internos WHERE id = NEW.enviado_por;
  INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
  VALUES (
    NEW.projeto_id,
    NEW.enviado_por,
    'documento',
    format('%s enviou "%s" (v%s)%s',
      COALESCE(_nome_autor, 'Usuário'),
      NEW.nome_arquivo,
      NEW.numero_versao,
      CASE WHEN COALESCE(NEW.descricao_da_versao,'') = '' THEN '' ELSE ' — ' || NEW.descricao_da_versao END
    ),
    true
  );
  RETURN NEW;
END; $function$;

-- Atualizar RLS policy: bloquear UPDATE de entradas automáticas
DROP POLICY IF EXISTS "interacoes: update autor" ON public.interacoes;
CREATE POLICY "interacoes: update autor (não automático)"
  ON public.interacoes FOR UPDATE TO authenticated
  USING ((usuario_id = auth.uid() OR public.is_admin(auth.uid())) AND NOT e_automatico)
  WITH CHECK ((usuario_id = auth.uid() OR public.is_admin(auth.uid())) AND NOT e_automatico);

-- Índice para melhorar performance de queries com e_automatico
CREATE INDEX IF NOT EXISTS interacoes_automatico_idx ON public.interacoes(projeto_id, e_automatico);
