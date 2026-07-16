-- ========================================================
-- Corrigir RLS policies para tarefas_projeto - v2
-- Simples: qualquer usuário autenticado pode criar tarefas
-- ========================================================

-- Remover policies antigas
DROP POLICY IF EXISTS "tarefas_projeto: select por escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: insert por escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: update por escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas_projeto: delete admin" ON public.tarefas_projeto;

-- Policies simples
CREATE POLICY "tarefas_projeto: select"
  ON public.tarefas_projeto FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tarefas_projeto: insert"
  ON public.tarefas_projeto FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "tarefas_projeto: update"
  ON public.tarefas_projeto FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "tarefas_projeto: delete"
  ON public.tarefas_projeto FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
