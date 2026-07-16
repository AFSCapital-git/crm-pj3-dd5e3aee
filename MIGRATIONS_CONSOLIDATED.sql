-- ============================================================
-- Executar todas as migrations do GestorFINEP
-- ============================================================
-- Copie todo este conteúdo no Supabase Dashboard → SQL Editor
-- Clique em RUN para executar todas as migrations


-- ============================================================
-- 20260714202054_ed966df2-09a6-4ae0-82e3-704ec0eaddcb.sql
-- ============================================================

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'consultor');
CREATE TYPE public.porte_empresa AS ENUM ('ME', 'EPP', 'Grande');
CREATE TYPE public.status_empresa AS ENUM ('lead', 'ativo', 'inativo');
CREATE TYPE public.categoria_edital AS ENUM ('subvencao_economica', 'reembolsavel', 'RHAE', 'outro');
CREATE TYPE public.status_projeto AS ENUM (
  'em_elaboracao','submetido','em_analise','aprovado','contratado',
  'em_execucao','em_prestacao_contas','encerrado','reprovado'
);
CREATE TYPE public.tipo_marco AS ENUM (
  'relatorio_tecnico','relatorio_financeiro','prestacao_contas_parcial','prestacao_contas_final'
);
CREATE TYPE public.status_marco AS ENUM ('pendente','entregue','atrasado');
CREATE TYPE public.tipo_interacao AS ENUM (
  'reuniao','email','ligacao','alteracao_cronograma','aditivo_contratual','nota'
);

-- =========================================================
-- USUARIOS INTERNOS (perfil espelhado do auth.users)
-- =========================================================
CREATE TABLE public.usuarios_internos (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios_internos TO authenticated;
GRANT ALL ON public.usuarios_internos TO service_role;
ALTER TABLE public.usuarios_internos ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separado, para evitar escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- HAS_ROLE (security definer para evitar recursão em RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin'); $$;

-- =========================================================
-- Policies para usuarios_internos e user_roles
-- =========================================================
CREATE POLICY "usuarios_internos self select"
  ON public.usuarios_internos FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "usuarios_internos admin insert"
  ON public.usuarios_internos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR id = auth.uid());
CREATE POLICY "usuarios_internos admin update"
  ON public.usuarios_internos FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR id = auth.uid());
CREATE POLICY "usuarios_internos admin delete"
  ON public.usuarios_internos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "user_roles read own or admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles admin manage"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- EMPRESAS CLIENTES
-- =========================================================
CREATE TABLE public.empresas_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  porte public.porte_empresa NOT NULL,
  setor_atuacao TEXT,
  contato_responsavel TEXT,
  email TEXT,
  telefone TEXT,
  consultor_responsavel_id UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  status public.status_empresa NOT NULL DEFAULT 'lead',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas_clientes TO authenticated;
GRANT ALL ON public.empresas_clientes TO service_role;
ALTER TABLE public.empresas_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas: consultor vê sua carteira / admin vê tudo"
  ON public.empresas_clientes FOR SELECT TO authenticated
  USING (consultor_responsavel_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "empresas: admin insere / consultor insere para si"
  ON public.empresas_clientes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR consultor_responsavel_id = auth.uid());
CREATE POLICY "empresas: consultor edita sua carteira / admin edita tudo"
  ON public.empresas_clientes FOR UPDATE TO authenticated
  USING (consultor_responsavel_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (consultor_responsavel_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "empresas: apenas admin deleta"
  ON public.empresas_clientes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- LINHAS / EDITAIS FINEP
-- =========================================================
CREATE TABLE public.linhas_editais_finep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria public.categoria_edital NOT NULL,
  orgao TEXT,
  valor_maximo_edital NUMERIC(15,2),
  prazo_submissao DATE,
  requisitos_elegibilidade TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linhas_editais_finep TO authenticated;
GRANT ALL ON public.linhas_editais_finep TO service_role;
ALTER TABLE public.linhas_editais_finep ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editais: todos autenticados leem"
  ON public.linhas_editais_finep FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "editais: apenas admin escreve"
  ON public.linhas_editais_finep FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- PROJETOS
-- =========================================================
CREATE TABLE public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
  linha_edital_id UUID REFERENCES public.linhas_editais_finep(id) ON DELETE SET NULL,
  nome_projeto TEXT NOT NULL,
  valor_solicitado NUMERIC(15,2),
  valor_aprovado NUMERIC(15,2),
  status public.status_projeto NOT NULL DEFAULT 'em_elaboracao',
  data_submissao DATE,
  prazo_execucao_meses INT,
  area_tecnologica TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- helper para checar propriedade via empresa
CREATE OR REPLACE FUNCTION public.projeto_no_escopo(_projeto_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.projetos p
    JOIN public.empresas_clientes e ON e.id = p.empresa_cliente_id
    WHERE p.id = _projeto_id AND e.consultor_responsavel_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.empresa_no_escopo(_empresa_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.empresas_clientes e
    WHERE e.id = _empresa_id AND e.consultor_responsavel_id = _user_id
  );
$$;

CREATE POLICY "projetos: escopo por consultor / admin"
  ON public.projetos FOR SELECT TO authenticated
  USING (public.empresa_no_escopo(empresa_cliente_id, auth.uid()));
CREATE POLICY "projetos: insert dentro do escopo"
  ON public.projetos FOR INSERT TO authenticated
  WITH CHECK (public.empresa_no_escopo(empresa_cliente_id, auth.uid()));
CREATE POLICY "projetos: update dentro do escopo"
  ON public.projetos FOR UPDATE TO authenticated
  USING (public.empresa_no_escopo(empresa_cliente_id, auth.uid()))
  WITH CHECK (public.empresa_no_escopo(empresa_cliente_id, auth.uid()));
CREATE POLICY "projetos: delete admin"
  ON public.projetos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- MARCOS / ENTREGAS
-- =========================================================
CREATE TABLE public.marcos_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tipo public.tipo_marco NOT NULL,
  descricao TEXT,
  data_prevista DATE NOT NULL,
  data_entrega_real DATE,
  status public.status_marco NOT NULL DEFAULT 'pendente',
  responsavel_id UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marcos_entregas TO authenticated;
GRANT ALL ON public.marcos_entregas TO service_role;
ALTER TABLE public.marcos_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcos: escopo por projeto"
  ON public.marcos_entregas FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "marcos: insert no escopo"
  ON public.marcos_entregas FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "marcos: update no escopo"
  ON public.marcos_entregas FOR UPDATE TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()))
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "marcos: delete no escopo"
  ON public.marcos_entregas FOR DELETE TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));

-- =========================================================
-- INTERACOES (linha do tempo)
-- =========================================================
CREATE TABLE public.interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  tipo public.tipo_interacao NOT NULL,
  descricao TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacoes TO authenticated;
GRANT ALL ON public.interacoes TO service_role;
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interacoes: escopo por projeto"
  ON public.interacoes FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "interacoes: insert no escopo"
  ON public.interacoes FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "interacoes: update autor"
  ON public.interacoes FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "interacoes: delete admin"
  ON public.interacoes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- Trigger updated_at genérico
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_usuarios_internos_updated BEFORE UPDATE ON public.usuarios_internos FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER t_empresas_updated BEFORE UPDATE ON public.empresas_clientes FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER t_editais_updated BEFORE UPDATE ON public.linhas_editais_finep FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER t_projetos_updated BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER t_marcos_updated BEFORE UPDATE ON public.marcos_entregas FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- AUDITORIA AUTOMÁTICA em projetos e marcos
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_audit_projetos() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF COALESCE(NEW.valor_aprovado,-1) IS DISTINCT FROM COALESCE(OLD.valor_aprovado,-1) THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
    VALUES (NEW.id, uid, 'aditivo_contratual',
      format('Valor aprovado alterado de %s para %s',
        COALESCE(to_char(OLD.valor_aprovado,'FM999G999G990D00'),'—'),
        COALESCE(to_char(NEW.valor_aprovado,'FM999G999G990D00'),'—')));
  END IF;
  IF COALESCE(NEW.prazo_execucao_meses,-1) IS DISTINCT FROM COALESCE(OLD.prazo_execucao_meses,-1)
     OR COALESCE(NEW.data_submissao, DATE '1900-01-01') IS DISTINCT FROM COALESCE(OLD.data_submissao, DATE '1900-01-01') THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
    VALUES (NEW.id, uid, 'alteracao_cronograma',
      format('Cronograma alterado (prazo: %s meses; submissão: %s)',
        COALESCE(NEW.prazo_execucao_meses::text,'—'),
        COALESCE(NEW.data_submissao::text,'—')));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
    VALUES (NEW.id, uid, 'nota',
      format('Status alterado de "%s" para "%s"', OLD.status, NEW.status));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER t_audit_projetos AFTER UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_projetos();

CREATE OR REPLACE FUNCTION public.tg_audit_marcos() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF NEW.data_prevista IS DISTINCT FROM OLD.data_prevista THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
    VALUES (NEW.projeto_id, uid, 'alteracao_cronograma',
      format('Data prevista do marco "%s" alterada de %s para %s',
        NEW.tipo, OLD.data_prevista, NEW.data_prevista));
  END IF;
  IF NEW.data_entrega_real IS DISTINCT FROM OLD.data_entrega_real AND NEW.data_entrega_real IS NOT NULL THEN
    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao)
    VALUES (NEW.projeto_id, uid, 'nota',
      format('Marco "%s" entregue em %s (previsto: %s, %s dias %s)',
        NEW.tipo, NEW.data_entrega_real, NEW.data_prevista,
        ABS(NEW.data_entrega_real - NEW.data_prevista),
        CASE WHEN NEW.data_entrega_real > NEW.data_prevista THEN 'de atraso' ELSE 'de antecedência/no prazo' END));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER t_audit_marcos AFTER UPDATE ON public.marcos_entregas
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_marcos();

-- =========================================================
-- VIEW marcos_com_urgencia
-- =========================================================
CREATE VIEW public.marcos_com_urgencia
WITH (security_invoker=on) AS
SELECT
  m.*,
  p.nome_projeto,
  p.empresa_cliente_id,
  e.razao_social AS empresa_razao_social,
  e.consultor_responsavel_id,
  (m.data_prevista - CURRENT_DATE) AS dias_para_vencer,
  CASE
    WHEN m.data_entrega_real IS NOT NULL THEN 'ok'
    WHEN m.data_prevista < CURRENT_DATE THEN 'vencido'
    WHEN m.data_prevista <= CURRENT_DATE + 7 THEN 'critico_7'
    WHEN m.data_prevista <= CURRENT_DATE + 15 THEN 'alerta_15'
    WHEN m.data_prevista <= CURRENT_DATE + 30 THEN 'aviso_30'
    ELSE 'ok'
  END AS urgencia
FROM public.marcos_entregas m
JOIN public.projetos p ON p.id = m.projeto_id
JOIN public.empresas_clientes e ON e.id = p.empresa_cliente_id;

GRANT SELECT ON public.marcos_com_urgencia TO authenticated;

-- =========================================================
-- Auto-provisiona usuarios_internos ao criar usuário no auth
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usuarios_internos (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;
  -- primeiro usuário criado vira admin; demais entram como consultor
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultor')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 20260714202113_56ef761b-1638-4915-b5a4-32285fea0715.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.projeto_no_escopo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.empresa_no_escopo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tg_audit_projetos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_audit_marcos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260714203715_0e194eb6-b264-43bf-bdf2-7ad87ee82f25.sql
-- ============================================================
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;
-- ============================================================
-- 20260714204152_18dc0f25-37bc-4d67-a34b-71585e2d2c7e.sql
-- ============================================================

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

-- ============================================================
-- 20260714204859_143bd932-6293-490f-88e8-76a32b304441.sql
-- ============================================================

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

-- ============================================================
-- 20260714205114_b7dca12e-6aec-4497-9ad9-7d8bf652c1a7.sql
-- ============================================================

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

-- ============================================================
-- 20260714205610_b3bebb48-2a9d-4ca5-9e53-b7bfa2ac01f2.sql
-- ============================================================

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

-- ============================================================
-- 20260714210058_a8e3c2ad-8f80-4623-9792-7a1d680a1dc2.sql
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS emails_vinculados_projeto_dedup_uidx ON public.emails_vinculados (projeto_id, dedup_hash);
-- ============================================================
-- 20260714211832_662e940c-a033-489d-83d6-7a6fcee028f2.sql
-- ============================================================

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

-- ============================================================
-- 20260714212614_270af302-ed98-4079-8729-f1e2dfb5ac9d.sql
-- ============================================================

ALTER TABLE public.insights_ia DROP CONSTRAINT IF EXISTS insights_ia_revisado_por_fkey;
ALTER TABLE public.insights_ia DROP CONSTRAINT IF EXISTS insights_ia_gerado_por_fkey;
ALTER TABLE public.insights_ia
  ADD CONSTRAINT insights_ia_revisado_por_fkey
  FOREIGN KEY (revisado_por) REFERENCES public.usuarios_internos(id) ON DELETE SET NULL;
ALTER TABLE public.insights_ia
  ADD CONSTRAINT insights_ia_gerado_por_fkey
  FOREIGN KEY (gerado_por) REFERENCES public.usuarios_internos(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 20260714_audit_email_linking.sql
-- ============================================================
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

-- ============================================================
-- 20260714_consolidacao_rpcs.sql
-- ============================================================
-- Migration: Consolidação de RPC e documentação de paginação
-- Criado: 2026-07-14
-- Objetivo: Remover duplicatas e documentar padrões de paginação

-- ============================================================
-- Nota sobre paginação cursor-based
-- ============================================================
-- Para tabelas grandes (> 1000 linhas), a paginação offset/limit
-- fica lenta porque o BD precisa fazer scan até a posição.
--
-- Solução: Cursor-based pagination
-- - Cursor = ID ou timestamp do último item da página anterior
-- - Query busca itens APÓS o cursor (usando comparações)
-- - Sempre O(log n) com índice apropriado
--
-- Implementação no código:
-- - src/lib/pagination.functions.ts (server functions)
-- - src/hooks/use-paginated-query.tsx (React hooks)
--
-- Usar quando:
-- - Listagem com > 1000 itens esperados
-- - Tabelas que crescem continuamente
-- - Infinite scroll ou "carregar mais"
--
-- Não usar quando:
-- - Tabelas pequenas (< 100 itens)
-- - Paginação já implementada no cliente
-- - Acesso aleatório a páginas (ex: "ir para página 5")

-- ============================================================
-- Consolidação: remover função duplicada
-- ============================================================
-- A função registrar_nova_versao_documento foi mantida apenas na migração
-- 20260714205114_b7dca12e-6aec-4497-9ad9-7d8bf652c1a7.sql (versão completa)
-- que suporta projeto OU empresa.
--
-- Versão obsoleta em 20260714204152 foi marcada como DEPRECATED.

-- ============================================================
-- Recomendação: Usar paginação em produção
-- ============================================================
-- Substituir gradualmente:
-- - listEmpresas() → listEmpresasPaginado() (com cursor)
-- - listEditais() → listEditaisPaginado() (com cursor)
-- - getCronograma() → listMarcosPaginado() (com cursor)
--
-- O limite de 1000 no servidor é temporário.
-- Eventualmente todas as listas usarão cursor-based pagination.

-- ============================================================
-- 20260714_performance_indexes.sql
-- ============================================================
-- Migration: Adicionar índices em Foreign Keys para melhor performance
-- Criado: 2026-07-14
-- Objetivo: Evitar table scans ao filtrar por FK

-- Índice 1: projetos.empresa_cliente_id
-- Usado em: listProjetos (filtro por empresa), getCronograma (via marcos)
CREATE INDEX IF NOT EXISTS projetos_empresa_cliente_id_idx
  ON public.projetos(empresa_cliente_id);

-- Índice 2: marcos_entregas.projeto_id
-- Usado em: getCronograma, getProjeto (marco timeline)
CREATE INDEX IF NOT EXISTS marcos_entregas_projeto_id_idx
  ON public.marcos_entregas(projeto_id);

-- Índice 3: interacoes.projeto_id
-- Usado em: getProjeto (fetch timeline interações)
CREATE INDEX IF NOT EXISTS interacoes_projeto_id_idx
  ON public.interacoes(projeto_id);

-- Índice 4: user_roles.user_id (bonus performance)
-- Usado em: listUsuarios (mapear user → roles)
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx
  ON public.user_roles(user_id);

-- ============================================================
-- 20260715183458_bc5f6f79-c16f-414a-9495-3438f937ac60.sql
-- ============================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. usuarios_internos: novos campos
ALTER TABLE public.usuarios_internos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('convidado','ativo','desativado')),
  ADD COLUMN IF NOT EXISTS ultimo_login timestamptz,
  ADD COLUMN IF NOT EXISTS convidado_por uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL;

-- Sincroniza status <-> ativo (mantém compatibilidade com código existente)
CREATE OR REPLACE FUNCTION public.tg_sync_usuario_status_ativo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN NEW.status := CASE WHEN NEW.ativo THEN 'ativo' ELSE 'desativado' END; END IF;
    NEW.ativo := (NEW.status = 'ativo');
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.ativo := (NEW.status = 'ativo');
    ELSIF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
      NEW.status := CASE WHEN NEW.ativo THEN 'ativo' ELSE 'desativado' END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_usuario_status_ativo ON public.usuarios_internos;
CREATE TRIGGER trg_sync_usuario_status_ativo
BEFORE INSERT OR UPDATE ON public.usuarios_internos
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_usuario_status_ativo();

-- 3. convites
CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_convidado citext NOT NULL,
  papel_designado app_role NOT NULL,
  nome_sugerido text,
  token_hash text NOT NULL UNIQUE,
  data_expiracao timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceito','expirado','revogado')),
  convidado_por uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  usuario_criado_id uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  aceito_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS convites_email_idx ON public.convites (email_convidado);
CREATE INDEX IF NOT EXISTS convites_status_idx ON public.convites (status);
-- Só um convite pendente por e-mail
CREATE UNIQUE INDEX IF NOT EXISTS convites_email_pendente_uidx
  ON public.convites (email_convidado) WHERE status = 'pendente';

GRANT SELECT, INSERT, UPDATE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê convites" ON public.convites;
CREATE POLICY "Admin lê convites" ON public.convites
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia convites" ON public.convites;
CREATE POLICY "Admin gerencia convites" ON public.convites
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin atualiza convites" ON public.convites;
CREATE POLICY "Admin atualiza convites" ON public.convites
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_convites_updated_at ON public.convites;
CREATE TRIGGER trg_convites_updated_at
BEFORE UPDATE ON public.convites
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 4. log_auditoria_admin (append-only)
CREATE TABLE IF NOT EXISTS public.log_auditoria_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_que_executou uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  acao text NOT NULL,
  usuario_afetado uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  convite_id uuid REFERENCES public.convites(id) ON DELETE SET NULL,
  detalhes_da_acao jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS log_auditoria_data_idx ON public.log_auditoria_admin (data_hora DESC);
CREATE INDEX IF NOT EXISTS log_auditoria_exec_idx ON public.log_auditoria_admin (usuario_que_executou);
CREATE INDEX IF NOT EXISTS log_auditoria_afetado_idx ON public.log_auditoria_admin (usuario_afetado);

-- Somente SELECT e INSERT — sem UPDATE/DELETE em nível de tabela para authenticated.
GRANT SELECT, INSERT ON public.log_auditoria_admin TO authenticated;
GRANT SELECT, INSERT ON public.log_auditoria_admin TO service_role;

ALTER TABLE public.log_auditoria_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê log" ON public.log_auditoria_admin;
CREATE POLICY "Admin lê log" ON public.log_auditoria_admin
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin insere log" ON public.log_auditoria_admin;
CREATE POLICY "Admin insere log" ON public.log_auditoria_admin
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- 5. usuarios_internos: policies extras para admin (mantém as existentes)
DROP POLICY IF EXISTS "Admin gerencia usuarios" ON public.usuarios_internos;
CREATE POLICY "Admin gerencia usuarios" ON public.usuarios_internos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Bloqueio: último admin ativo não pode ser removido/desativado
CREATE OR REPLACE FUNCTION public.pode_alterar_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*)
    FROM public.user_roles r
    JOIN public.usuarios_internos u ON u.id = r.user_id
    WHERE r.role = 'admin' AND u.status = 'ativo' AND r.user_id <> _user_id
  ) >= 1
$$;

CREATE OR REPLACE FUNCTION public.tg_protege_ultimo_admin_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin') THEN
    IF NOT public.pode_alterar_admin(OLD.user_id) THEN
      RAISE EXCEPTION 'Não é possível remover o papel admin do último administrador ativo do sistema.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN COALESCE(OLD, NEW);
END $$;

DROP TRIGGER IF EXISTS trg_protege_ultimo_admin_roles ON public.user_roles;
CREATE TRIGGER trg_protege_ultimo_admin_roles
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_protege_ultimo_admin_roles();

CREATE OR REPLACE FUNCTION public.tg_protege_ultimo_admin_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'ativo' AND OLD.status = 'ativo' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role = 'admin') THEN
      IF NOT public.pode_alterar_admin(OLD.id) THEN
        RAISE EXCEPTION 'Não é possível desativar o último administrador ativo do sistema.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protege_ultimo_admin_status ON public.usuarios_internos;
CREATE TRIGGER trg_protege_ultimo_admin_status
BEFORE UPDATE OF status, ativo ON public.usuarios_internos
FOR EACH ROW EXECUTE FUNCTION public.tg_protege_ultimo_admin_status();

-- 7. Job diário de expiração automática de convites
DO $$
BEGIN
  PERFORM cron.unschedule('convites-expirar-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'convites-expirar-diario',
  '0 3 * * *',
  $$UPDATE public.convites SET status='expirado'
     WHERE status='pendente' AND data_expiracao < now()$$
);

-- ============================================================
-- 20260715_admin_usuarios_seguro.sql
-- ============================================================
-- Correções de segurança no módulo de Administração de Usuários

-- 1. Adicionar coluna deleted_at para soft delete
ALTER TABLE public.usuarios_internos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Índice para performance (queries que filtram por deleted_at)
CREATE INDEX IF NOT EXISTS usuarios_internos_deleted_at_idx
  ON public.usuarios_internos(deleted_at);

-- 3. Atualizar RLS policy para verificar ativo=true E deleted_at IS NULL
DROP POLICY IF EXISTS "usuarios_internos self select" ON public.usuarios_internos;
CREATE POLICY "usuarios_internos self select (ativo e não deletado)"
  ON public.usuarios_internos FOR SELECT TO authenticated
  USING (
    (id = auth.uid() OR public.is_admin(auth.uid()))
    AND ativo = true
    AND deleted_at IS NULL
  );

-- 4. Restringir UPDATE/DELETE se deletado
DROP POLICY IF EXISTS "usuarios_internos admin update" ON public.usuarios_internos;
CREATE POLICY "usuarios_internos admin update (não deletado)"
  ON public.usuarios_internos FOR UPDATE TO authenticated
  USING (
    (public.is_admin(auth.uid()) OR id = auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (public.is_admin(auth.uid()) OR id = auth.uid())
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "usuarios_internos admin delete" ON public.usuarios_internos;
CREATE POLICY "usuarios_internos admin delete (soft delete only)"
  ON public.usuarios_internos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND deleted_at IS NULL);

-- 5. Função para deativar usuário (soft delete)
-- Não deleta de auth.users (causaria CASCADE delete)
-- Apenas marca como inativo e deleted_at para bloquear acesso
CREATE OR REPLACE FUNCTION public.deactivate_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role app_role;
  _admin_count INT;
BEGIN
  -- Validar que quem chama é admin
  SELECT role INTO _caller_role FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin' LIMIT 1;

  IF _caller_role IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem desativar usuários.';
  END IF;

  -- Validar que não é o último admin
  SELECT COUNT(*) INTO _admin_count FROM public.user_roles
    WHERE role = 'admin' AND user_id != _user_id;

  IF _admin_count = 0 THEN
    RAISE EXCEPTION 'Não é possível desativar o último administrador do sistema.';
  END IF;

  -- Soft delete: marca como inativo e deletado
  UPDATE public.usuarios_internos
    SET ativo = false, deleted_at = now(), updated_at = now()
    WHERE id = _user_id;

  RETURN TRUE;
END; $$;

-- 6. Função para reativar usuário
CREATE OR REPLACE FUNCTION public.reactivate_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role app_role;
BEGIN
  -- Validar que quem chama é admin
  SELECT role INTO _caller_role FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin' LIMIT 1;

  IF _caller_role IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem reativar usuários.';
  END IF;

  -- Reativar: marca como ativo novamente
  UPDATE public.usuarios_internos
    SET ativo = true, deleted_at = null, updated_at = now()
    WHERE id = _user_id;

  RETURN TRUE;
END; $$;

-- 7. Grant das funções
GRANT EXECUTE ON FUNCTION public.deactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_user(UUID) TO authenticated;

-- ============================================================
-- 20260715_auditoria_imutavel.sql
-- ============================================================
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

-- ============================================================
-- 20260715_validacao_dados.sql
-- ============================================================
-- Validações: tamanho de arquivo, duplicatas no catálogo, CNPJ único

-- 1. Validar tamanho máximo de arquivo (25 MB = 26843545 bytes)
-- Nota: Validação primária no código (documentos.functions.ts),
-- isto é um constraint de backup no banco
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_tamanho_maximo
    CHECK (tamanho_arquivo <= 26843545); -- 25 MB em bytes

-- 2. UNIQUE constraint em linhas de edital (nome + categoria)
-- Previne dois editais com mesmo nome na mesma categoria
ALTER TABLE public.linhas_editais_finep
  ADD CONSTRAINT linhas_edital_nome_categoria_uniq
    UNIQUE (nome, categoria);

-- 3. Garantir que CNPJ é apenas dígitos (14 dígitos)
-- Constraint no banco como backup da validação no código
ALTER TABLE public.empresas_clientes
  ADD CONSTRAINT empresas_cnpj_format
    CHECK (cnpj ~ '^\d{14}$'); -- Regex: exatamente 14 dígitos
