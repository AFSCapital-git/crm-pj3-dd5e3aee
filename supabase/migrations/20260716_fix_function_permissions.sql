-- ============================================================
-- Fix: Adicionar GRANT EXECUTE para funções de segurança
-- ============================================================

-- is_admin e has_role precisam ser executáveis por authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(_user_id UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id UUID, _role VARCHAR) TO authenticated, service_role;

-- Funções de escopo (projeto_no_escopo, empresa_no_escopo)
GRANT EXECUTE ON FUNCTION public.projeto_no_escopo(_projeto_id UUID, _user_id UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.empresa_no_escopo(_empresa_id UUID, _user_id UUID) TO authenticated, service_role;
