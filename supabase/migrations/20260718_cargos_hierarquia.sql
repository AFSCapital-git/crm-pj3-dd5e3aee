-- ========================================================
-- Cargos com hierarquia: Admin/Coordenador/Projetista
-- + novos campos de hierarquia e senha temporária
-- ========================================================

-- 1. Renomear enum value e adicionar novo
ALTER TYPE public.app_role RENAME VALUE 'consultor' TO 'projetista';
ALTER TYPE public.app_role ADD VALUE 'coordenador';

-- 2. Novas colunas em usuarios_internos
ALTER TABLE public.usuarios_internos
  ADD COLUMN coordenador_id UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  ADD COLUMN ve_todos_projetos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN senha_temporaria BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT usuarios_internos_coordenador_nao_proprio CHECK (coordenador_id IS NULL OR coordenador_id <> id);

-- 3. Novas colunas em convites
ALTER TABLE public.convites
  ADD COLUMN coordenador_id UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  ADD COLUMN ve_todos_projetos BOOLEAN NOT NULL DEFAULT false;

-- 4. Reescrever funcoes de escopo com nova hierarquia
CREATE OR REPLACE FUNCTION public.empresa_no_escopo(_empresa_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.empresas_clientes e
      WHERE e.id = _empresa_id AND e.consultor_responsavel_id = _user_id
    )
    OR (
      public.has_role(_user_id, 'coordenador')
      AND EXISTS (SELECT 1 FROM public.usuarios_internos u WHERE u.id = _user_id AND u.ve_todos_projetos)
    )
    OR (
      public.has_role(_user_id, 'coordenador')
      AND EXISTS (
        SELECT 1 FROM public.empresas_clientes e
        JOIN public.usuarios_internos resp ON resp.id = e.consultor_responsavel_id
        WHERE e.id = _empresa_id AND resp.coordenador_id = _user_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.projeto_no_escopo(_projeto_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.empresa_no_escopo(
    (SELECT empresa_cliente_id FROM public.projetos WHERE id = _projeto_id),
    _user_id
  );
$$;

-- 5. Atualizar trigger handle_new_user para usar 'projetista' como role default
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usuarios_internos (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'projetista')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- 6. Corrigir RLS de tarefas_projeto
DROP POLICY IF EXISTS "tarefas_projeto: select" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: insert" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: update" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: delete" ON public.tarefas_projeto;

CREATE POLICY "tarefas_projeto: select por escopo" ON public.tarefas_projeto
  FOR SELECT TO authenticated USING (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "tarefas_projeto: insert por escopo" ON public.tarefas_projeto
  FOR INSERT TO authenticated WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "tarefas_projeto: update por escopo" ON public.tarefas_projeto
  FOR UPDATE TO authenticated USING (public.projeto_no_escopo(projeto_id, auth.uid()))
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));
CREATE POLICY "tarefas_projeto: delete admin" ON public.tarefas_projeto
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
