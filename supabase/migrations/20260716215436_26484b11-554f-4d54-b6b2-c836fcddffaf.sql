DROP POLICY IF EXISTS "tarefas: admin deleta" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas: editar se projeto no escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas: inserir se projeto no escopo" ON public.tarefas_projeto;
DROP POLICY IF EXISTS "tarefas: ver se projeto no escopo" ON public.tarefas_projeto;