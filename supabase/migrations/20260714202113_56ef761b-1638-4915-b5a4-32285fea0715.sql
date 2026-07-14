
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.projeto_no_escopo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.empresa_no_escopo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tg_audit_projetos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_audit_marcos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
