
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
