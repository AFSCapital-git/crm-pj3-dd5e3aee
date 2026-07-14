
-- 1. schema
ALTER TABLE public.documentos ALTER COLUMN projeto_id DROP NOT NULL;
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS empresa_cliente_id UUID REFERENCES public.empresas_clientes(id) ON DELETE CASCADE;
ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_owner_xor;
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_owner_xor CHECK (
    (projeto_id IS NOT NULL)::int + (empresa_cliente_id IS NOT NULL)::int = 1
  );
CREATE INDEX IF NOT EXISTS documentos_empresa_idx ON public.documentos(empresa_cliente_id);

-- 2. RLS
DROP POLICY IF EXISTS "Documentos: leitura por escopo do projeto" ON public.documentos;
DROP POLICY IF EXISTS "Documentos: inserir por escopo do projeto" ON public.documentos;
DROP POLICY IF EXISTS "Documentos: atualizar por escopo do projeto" ON public.documentos;

CREATE POLICY "Documentos: leitura no escopo"
ON public.documentos FOR SELECT TO authenticated
USING (
  (projeto_id IS NOT NULL AND public.projeto_no_escopo(projeto_id, auth.uid()))
  OR
  (empresa_cliente_id IS NOT NULL AND public.empresa_no_escopo(empresa_cliente_id, auth.uid()))
);

CREATE POLICY "Documentos: inserir no escopo"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (
  (projeto_id IS NOT NULL AND public.projeto_no_escopo(projeto_id, auth.uid()))
  OR
  (empresa_cliente_id IS NOT NULL AND public.empresa_no_escopo(empresa_cliente_id, auth.uid()))
);

CREATE POLICY "Documentos: atualizar no escopo"
ON public.documentos FOR UPDATE TO authenticated
USING (
  (projeto_id IS NOT NULL AND public.projeto_no_escopo(projeto_id, auth.uid()))
  OR
  (empresa_cliente_id IS NOT NULL AND public.empresa_no_escopo(empresa_cliente_id, auth.uid()))
)
WITH CHECK (
  (projeto_id IS NOT NULL AND public.projeto_no_escopo(projeto_id, auth.uid()))
  OR
  (empresa_cliente_id IS NOT NULL AND public.empresa_no_escopo(empresa_cliente_id, auth.uid()))
);

-- 3. Storage policies: adicionar prefixo "empresa/{uuid}/..."
CREATE POLICY "Docs storage: leitura por escopo da empresa"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-projetos'
  AND (storage.foldername(name))[1] = 'empresa'
  AND public.empresa_no_escopo(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "Docs storage: upload por escopo da empresa"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-projetos'
  AND (storage.foldername(name))[1] = 'empresa'
  AND public.empresa_no_escopo(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "Docs storage: update por escopo da empresa"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos-projetos'
  AND (storage.foldername(name))[1] = 'empresa'
  AND public.empresa_no_escopo(((storage.foldername(name))[2])::uuid, auth.uid())
);

-- 4. audit trigger: interacoes exige projeto_id; pular quando for documento de empresa
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

-- 5. RPC de nova versão: aceita projeto OU empresa
CREATE OR REPLACE FUNCTION public.registrar_nova_versao_documento(
  _projeto_id uuid,
  _grupo_documento_id uuid,
  _tipo tipo_documento,
  _nome_arquivo text,
  _storage_path text,
  _tamanho_arquivo bigint,
  _mime_type text,
  _descricao text,
  _empresa_cliente_id uuid DEFAULT NULL
)
 RETURNS documentos
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _prox_versao INT;
  _nova public.documentos;
BEGIN
  IF (_projeto_id IS NULL) = (_empresa_cliente_id IS NULL) THEN
    RAISE EXCEPTION 'Informe exatamente um: projeto ou empresa';
  END IF;

  IF _projeto_id IS NOT NULL AND NOT public.projeto_no_escopo(_projeto_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para este projeto';
  END IF;
  IF _empresa_cliente_id IS NOT NULL AND NOT public.empresa_no_escopo(_empresa_cliente_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa';
  END IF;

  UPDATE public.documentos
     SET e_versao_atual = false
   WHERE grupo_documento_id = _grupo_documento_id AND e_versao_atual;

  SELECT COALESCE(MAX(numero_versao),0)+1 INTO _prox_versao
    FROM public.documentos WHERE grupo_documento_id = _grupo_documento_id;

  INSERT INTO public.documentos (
    projeto_id, empresa_cliente_id, grupo_documento_id, tipo, nome_arquivo, numero_versao,
    storage_path, tamanho_arquivo, mime_type, enviado_por,
    descricao_da_versao, e_versao_atual
  ) VALUES (
    _projeto_id, _empresa_cliente_id, _grupo_documento_id, _tipo, _nome_arquivo, _prox_versao,
    _storage_path, _tamanho_arquivo, _mime_type, auth.uid(),
    COALESCE(_descricao,''), true
  ) RETURNING * INTO _nova;

  RETURN _nova;
END; $function$;
