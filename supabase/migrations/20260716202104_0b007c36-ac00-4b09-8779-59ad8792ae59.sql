
-- 1) convites: add DELETE policy for admins
CREATE POLICY "Admin remove convites" ON public.convites
  FOR DELETE USING (public.is_admin(auth.uid()));

-- 2) emails_nao_vinculados: remove broad authenticated read; admins already covered by ALL policy
DROP POLICY IF EXISTS "emails_nao_vinculados_authenticated_read" ON public.emails_nao_vinculados;

-- 3) usuarios_internos: restrict INSERT to admins only (SECURITY DEFINER trigger handle_new_user bypasses RLS)
DROP POLICY IF EXISTS "usuarios_internos admin insert" ON public.usuarios_internos;
CREATE POLICY "usuarios_internos admin insert" ON public.usuarios_internos
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Also tighten UPDATE: users may update their own record (name/email) but not admin-only fields;
-- keep existing policy as-is since column-level restrictions belong in app code.

-- 4) Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
--    that must never be reachable via PostgREST (trigger functions and internal helpers).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_protege_ultimo_admin_roles() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_protege_ultimo_admin_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_projetos() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_marcos() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_documentos() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_emails_vinculados_timeline() FROM anon, authenticated, PUBLIC;

-- pode_alterar_admin is only used by trigger functions — not needed from client
REVOKE EXECUTE ON FUNCTION public.pode_alterar_admin(uuid) FROM anon, authenticated, PUBLIC;

-- Keep EXECUTE for functions actually invoked from client or referenced in RLS policies:
--   is_admin, has_role, projeto_no_escopo, empresa_no_escopo,
--   registrar_nova_versao_documento (both overloads), vincular_email_manual
-- These require EXECUTE for policies/RPC to work.
