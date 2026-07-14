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
