
-- Add address columns to empresas_clientes
ALTER TABLE public.empresas_clientes
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS rua text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;

-- Discussion messages (per project)
CREATE TABLE IF NOT EXISTS public.discussao_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  mensagem text NOT NULL,
  editado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussao_mensagens TO authenticated;
GRANT ALL ON public.discussao_mensagens TO service_role;
ALTER TABLE public.discussao_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussao: ver se projeto no escopo"
  ON public.discussao_mensagens FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(auth.uid(), projeto_id));
CREATE POLICY "discussao: inserir se projeto no escopo e autor = self"
  ON public.discussao_mensagens FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(auth.uid(), projeto_id) AND autor_id = auth.uid());
CREATE POLICY "discussao: autor edita própria"
  ON public.discussao_mensagens FOR UPDATE TO authenticated
  USING (autor_id = auth.uid()) WITH CHECK (autor_id = auth.uid());
CREATE POLICY "discussao: autor ou admin deleta"
  ON public.discussao_mensagens FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER t_discussao_updated BEFORE UPDATE ON public.discussao_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Project tasks
DO $$ BEGIN
  CREATE TYPE public.tarefa_prioridade AS ENUM ('baixa','media','alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tarefa_status AS ENUM ('pendente','em_andamento','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tarefas_projeto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  prioridade public.tarefa_prioridade NOT NULL DEFAULT 'media',
  status public.tarefa_status NOT NULL DEFAULT 'pendente',
  data_prazo date,
  origem_discussao_id uuid REFERENCES public.discussao_mensagens(id) ON DELETE SET NULL,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_projeto TO authenticated;
GRANT ALL ON public.tarefas_projeto TO service_role;
ALTER TABLE public.tarefas_projeto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarefas: ver se projeto no escopo"
  ON public.tarefas_projeto FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(auth.uid(), projeto_id));
CREATE POLICY "tarefas: inserir se projeto no escopo"
  ON public.tarefas_projeto FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(auth.uid(), projeto_id));
CREATE POLICY "tarefas: editar se projeto no escopo"
  ON public.tarefas_projeto FOR UPDATE TO authenticated
  USING (public.projeto_no_escopo(auth.uid(), projeto_id))
  WITH CHECK (public.projeto_no_escopo(auth.uid(), projeto_id));
CREATE POLICY "tarefas: admin deleta"
  ON public.tarefas_projeto FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER t_tarefas_updated BEFORE UPDATE ON public.tarefas_projeto
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
