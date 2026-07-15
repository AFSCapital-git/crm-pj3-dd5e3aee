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
