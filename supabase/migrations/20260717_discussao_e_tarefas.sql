-- ========================================================
-- Discussões em projeto + tarefas colaborativas
-- Cria timeline de discussão, tarefas rastreáveis e audit automático
-- ========================================================

-- 1. Adicionar coluna destacado à tabela interacoes
ALTER TABLE public.interacoes
  ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT false;

-- 2. Criar tipos enum para tarefas
CREATE TYPE public.status_tarefa AS ENUM ('pendente','em_andamento','concluida','cancelada');
CREATE TYPE public.prioridade_tarefa AS ENUM ('baixa','media','alta');

-- 3. Adicionar novo valor ao enum tipo_interacao
ALTER TYPE public.tipo_interacao ADD VALUE IF NOT EXISTS 'tarefa';

-- ========================================================
-- Tabela: discussao_mensagens
-- ========================================================
CREATE TABLE public.discussao_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.usuarios_internos(id),
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  editado_em TIMESTAMPTZ
);

-- Índice de performance para listagem por projeto
CREATE INDEX idx_discussao_projeto ON public.discussao_mensagens(projeto_id, created_at DESC);

-- RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussao_mensagens TO authenticated;
GRANT ALL ON public.discussao_mensagens TO service_role;

ALTER TABLE public.discussao_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussao_mensagens: select por escopo"
  ON public.discussao_mensagens FOR SELECT TO authenticated
  USING (public.projeto_no_escopo(projeto_id, auth.uid()));

CREATE POLICY "discussao_mensagens: insert por escopo"
  ON public.discussao_mensagens FOR INSERT TO authenticated
  WITH CHECK (public.projeto_no_escopo(projeto_id, auth.uid()) AND autor_id = auth.uid());

CREATE POLICY "discussao_mensagens: update autor"
  ON public.discussao_mensagens FOR UPDATE TO authenticated
  USING ((autor_id = auth.uid() OR public.is_admin(auth.uid())))
  WITH CHECK ((autor_id = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY "discussao_mensagens: delete autor"
  ON public.discussao_mensagens FOR DELETE TO authenticated
  USING ((autor_id = auth.uid() OR public.is_admin(auth.uid())));

-- Comentários de documentação
COMMENT ON TABLE public.discussao_mensagens IS 'Timeline de discussão colaborativa de um projeto';
COMMENT ON COLUMN public.discussao_mensagens.id IS 'Identificador único da mensagem';
COMMENT ON COLUMN public.discussao_mensagens.projeto_id IS 'Projeto ao qual a mensagem pertence';
COMMENT ON COLUMN public.discussao_mensagens.autor_id IS 'Usuário interno que criou a mensagem';
COMMENT ON COLUMN public.discussao_mensagens.mensagem IS 'Conteúdo da mensagem';
COMMENT ON COLUMN public.discussao_mensagens.created_at IS 'Data/hora de criação da mensagem';
COMMENT ON COLUMN public.discussao_mensagens.editado_em IS 'Data/hora da última edição (NULL se nunca editada)';

-- ========================================================
-- Tabela: tarefas_projeto
-- ========================================================
CREATE TABLE public.tarefas_projeto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  prioridade public.prioridade_tarefa NOT NULL DEFAULT 'media',
  status public.status_tarefa NOT NULL DEFAULT 'pendente',
  data_prazo DATE,
  origem_discussao_id UUID REFERENCES public.discussao_mensagens(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.usuarios_internos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ
);

-- Índices de performance
CREATE INDEX idx_tarefas_projeto_status ON public.tarefas_projeto(projeto_id, status);

-- RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_projeto TO authenticated;
GRANT ALL ON public.tarefas_projeto TO service_role;

ALTER TABLE public.tarefas_projeto ENABLE ROW LEVEL SECURITY;

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

-- Comentários de documentação
COMMENT ON TABLE public.tarefas_projeto IS 'Tarefas colaborativas vinculadas a um projeto';
COMMENT ON COLUMN public.tarefas_projeto.id IS 'Identificador único da tarefa';
COMMENT ON COLUMN public.tarefas_projeto.projeto_id IS 'Projeto ao qual a tarefa pertence';
COMMENT ON COLUMN public.tarefas_projeto.titulo IS 'Título descritivo da tarefa';
COMMENT ON COLUMN public.tarefas_projeto.descricao IS 'Descrição detalhada (opcional)';
COMMENT ON COLUMN public.tarefas_projeto.responsavel_id IS 'Usuário interno responsável pela tarefa (NULL se sem atribuição)';
COMMENT ON COLUMN public.tarefas_projeto.prioridade IS 'Nível de prioridade (baixa, media, alta)';
COMMENT ON COLUMN public.tarefas_projeto.status IS 'Estado atual da tarefa (pendente, em_andamento, concluida, cancelada)';
COMMENT ON COLUMN public.tarefas_projeto.data_prazo IS 'Data limite para conclusão (opcional)';
COMMENT ON COLUMN public.tarefas_projeto.origem_discussao_id IS 'Referência à mensagem de discussão que originou a tarefa (opcional)';
COMMENT ON COLUMN public.tarefas_projeto.created_by IS 'Usuário que criou a tarefa';
COMMENT ON COLUMN public.tarefas_projeto.created_at IS 'Data/hora de criação';
COMMENT ON COLUMN public.tarefas_projeto.updated_at IS 'Data/hora da última atualização';
COMMENT ON COLUMN public.tarefas_projeto.concluida_em IS 'Data/hora em que a tarefa foi marcada como concluída (NULL se não concluída)';

-- ========================================================
-- Função: toggle_interacao_destaque
-- ========================================================
CREATE OR REPLACE FUNCTION public.toggle_interacao_destaque(_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _projeto_id UUID;
BEGIN
  -- Obter projeto_id da interação para validar acesso
  SELECT projeto_id INTO _projeto_id FROM public.interacoes WHERE id = _id;

  IF _projeto_id IS NULL THEN
    RAISE EXCEPTION 'Interação não encontrada';
  END IF;

  -- Validar que o usuário tem acesso ao projeto
  IF NOT public.projeto_no_escopo(_projeto_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Alternar destaque
  UPDATE public.interacoes
  SET destacado = NOT destacado
  WHERE id = _id;
END; $$;

-- ========================================================
-- Trigger: tg_audit_tarefas
-- ========================================================
CREATE OR REPLACE FUNCTION public.tg_audit_tarefas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nome_responsavel TEXT;
  _descricao_evento TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Criar interação ao inserir tarefa
    _nome_responsavel := CASE
      WHEN NEW.responsavel_id IS NOT NULL
      THEN (SELECT nome FROM public.usuarios_internos WHERE id = NEW.responsavel_id)
      ELSE NULL
    END;

    _descricao_evento := 'Tarefa criada: ' || NEW.titulo ||
      CASE
        WHEN _nome_responsavel IS NOT NULL
        THEN ' (responsável: ' || _nome_responsavel || ')'
        ELSE ''
      END;

    INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
    VALUES (NEW.projeto_id, NULL, 'tarefa', _descricao_evento, true);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualização de status para concluída
    IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
      VALUES (NEW.projeto_id, NULL, 'tarefa', 'Tarefa concluída: ' || NEW.titulo, true);

    -- Atualização de responsável
    ELSIF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
      _nome_responsavel := CASE
        WHEN NEW.responsavel_id IS NOT NULL
        THEN (SELECT nome FROM public.usuarios_internos WHERE id = NEW.responsavel_id)
        ELSE NULL
      END;

      INSERT INTO public.interacoes (projeto_id, usuario_id, tipo, descricao, e_automatico)
      VALUES (NEW.projeto_id, NULL, 'tarefa', 'Tarefa reatribuída: ' || NEW.titulo, true);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_audit_tarefas ON public.tarefas_projeto;
CREATE TRIGGER tg_audit_tarefas
AFTER INSERT OR UPDATE ON public.tarefas_projeto
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tarefas();

-- ========================================================
-- Comentários adicionais
-- ========================================================
COMMENT ON FUNCTION public.toggle_interacao_destaque(_id UUID) IS 'Alterna o estado de destaque de uma interação. Requer acesso ao projeto.';
COMMENT ON FUNCTION public.tg_audit_tarefas() IS 'Trigger que registra na timeline as operações em tarefas (criação, conclusão, reatribuição)';
