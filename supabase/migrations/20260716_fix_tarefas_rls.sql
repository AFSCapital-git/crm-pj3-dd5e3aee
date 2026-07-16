-- ========================================================
-- Corrigir RLS policies para tarefas_projeto
-- ========================================================

-- Remover policies antigas
DROP POLICY IF EXISTS "tarefas_projeto: select por escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: insert por escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: update por escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: delete admin" ON public.tarefas_projeto;

-- Recriar com WITH CHECK correto
CREATE POLICY "tarefas_projeto: select por escopo"
  ON public.tarefas_projeto FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "tarefas_projeto: insert por escopo"
  ON public.tarefas_projeto FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "tarefas_projeto: update por escopo"
  ON public.tarefas_projeto FOR UPDATE TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()))
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "tarefas_projeto: delete admin"
  ON public.tarefas_projeto FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
