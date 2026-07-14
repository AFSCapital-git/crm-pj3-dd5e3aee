
ALTER TYPE public.tipo_interacao ADD VALUE IF NOT EXISTS 'documento';

CREATE OR REPLACE FUNCTION public.tg_audit_documentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nome_autor TEXT;
BEGIN
  SELECT nome INTO _nome_autor FROM public.usuarios_internos WHERE id = NEW.enviado_por;
  INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
  VALUES (
    NEW.projeto_id,
    NEW.enviado_por,
    'documento',
    format('%s enviou "%s" (v%s)%s',
      COALESCE(_nome_autor, 'Usuário'),
      NEW.nome_arquivo,
      NEW.numero_versao,
      CASE WHEN COALESCE(NEW.descricao_da_versao,'') = '' THEN '' ELSE ' — ' || NEW.descricao_da_versao END
    )
  );
  RETURN NEW;
END; $function$;
