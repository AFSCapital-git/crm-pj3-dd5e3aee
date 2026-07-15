
-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. usuarios_internos: novos campos
ALTER TABLE public.usuarios_internos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('convidado','ativo','desativado')),
  ADD COLUMN IF NOT EXISTS ultimo_login timestamptz,
  ADD COLUMN IF NOT EXISTS convidado_por uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL;

-- Sincroniza status <-> ativo (mantém compatibilidade com código existente)
CREATE OR REPLACE FUNCTION public.tg_sync_usuario_status_ativo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN NEW.status := CASE WHEN NEW.ativo THEN 'ativo' ELSE 'desativado' END; END IF;
    NEW.ativo := (NEW.status = 'ativo');
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.ativo := (NEW.status = 'ativo');
    ELSIF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
      NEW.status := CASE WHEN NEW.ativo THEN 'ativo' ELSE 'desativado' END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_usuario_status_ativo ON public.usuarios_internos;
CREATE TRIGGER trg_sync_usuario_status_ativo
BEFORE INSERT OR UPDATE ON public.usuarios_internos
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_usuario_status_ativo();

-- 3. convites
CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_convidado citext NOT NULL,
  papel_designado app_role NOT NULL,
  nome_sugerido text,
  token_hash text NOT NULL UNIQUE,
  data_expiracao timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceito','expirado','revogado')),
  convidado_por uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  usuario_criado_id uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  aceito_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS convites_email_idx ON public.convites (email_convidado);
CREATE INDEX IF NOT EXISTS convites_status_idx ON public.convites (status);
-- Só um convite pendente por e-mail
CREATE UNIQUE INDEX IF NOT EXISTS convites_email_pendente_uidx
  ON public.convites (email_convidado) WHERE status = 'pendente';

GRANT SELECT, INSERT, UPDATE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê convites" ON public.convites;
CREATE POLICY "Admin lê convites" ON public.convites
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia convites" ON public.convites;
CREATE POLICY "Admin gerencia convites" ON public.convites
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin atualiza convites" ON public.convites;
CREATE POLICY "Admin atualiza convites" ON public.convites
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_convites_updated_at ON public.convites;
CREATE TRIGGER trg_convites_updated_at
BEFORE UPDATE ON public.convites
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 4. log_auditoria_admin (append-only)
CREATE TABLE IF NOT EXISTS public.log_auditoria_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_que_executou uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  acao text NOT NULL,
  usuario_afetado uuid REFERENCES public.usuarios_internos(id) ON DELETE SET NULL,
  convite_id uuid REFERENCES public.convites(id) ON DELETE SET NULL,
  detalhes_da_acao jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS log_auditoria_data_idx ON public.log_auditoria_admin (data_hora DESC);
CREATE INDEX IF NOT EXISTS log_auditoria_exec_idx ON public.log_auditoria_admin (usuario_que_executou);
CREATE INDEX IF NOT EXISTS log_auditoria_afetado_idx ON public.log_auditoria_admin (usuario_afetado);

-- Somente SELECT e INSERT — sem UPDATE/DELETE em nível de tabela para authenticated.
GRANT SELECT, INSERT ON public.log_auditoria_admin TO authenticated;
GRANT SELECT, INSERT ON public.log_auditoria_admin TO service_role;

ALTER TABLE public.log_auditoria_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê log" ON public.log_auditoria_admin;
CREATE POLICY "Admin lê log" ON public.log_auditoria_admin
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin insere log" ON public.log_auditoria_admin;
CREATE POLICY "Admin insere log" ON public.log_auditoria_admin
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- 5. usuarios_internos: policies extras para admin (mantém as existentes)
DROP POLICY IF EXISTS "Admin gerencia usuarios" ON public.usuarios_internos;
CREATE POLICY "Admin gerencia usuarios" ON public.usuarios_internos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Bloqueio: último admin ativo não pode ser removido/desativado
CREATE OR REPLACE FUNCTION public.pode_alterar_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*)
    FROM public.user_roles r
    JOIN public.usuarios_internos u ON u.id = r.user_id
    WHERE r.role = 'admin' AND u.status = 'ativo' AND r.user_id <> _user_id
  ) >= 1
$$;

CREATE OR REPLACE FUNCTION public.tg_protege_ultimo_admin_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin') THEN
    IF NOT public.pode_alterar_admin(OLD.user_id) THEN
      RAISE EXCEPTION 'Não é possível remover o papel admin do último administrador ativo do sistema.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN COALESCE(OLD, NEW);
END $$;

DROP TRIGGER IF EXISTS trg_protege_ultimo_admin_roles ON public.user_roles;
CREATE TRIGGER trg_protege_ultimo_admin_roles
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_protege_ultimo_admin_roles();

CREATE OR REPLACE FUNCTION public.tg_protege_ultimo_admin_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'ativo' AND OLD.status = 'ativo' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role = 'admin') THEN
      IF NOT public.pode_alterar_admin(OLD.id) THEN
        RAISE EXCEPTION 'Não é possível desativar o último administrador ativo do sistema.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protege_ultimo_admin_status ON public.usuarios_internos;
CREATE TRIGGER trg_protege_ultimo_admin_status
BEFORE UPDATE OF status, ativo ON public.usuarios_internos
FOR EACH ROW EXECUTE FUNCTION public.tg_protege_ultimo_admin_status();

-- 7. Job diário de expiração automática de convites
DO $$
BEGIN
  PERFORM cron.unschedule('convites-expirar-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'convites-expirar-diario',
  '0 3 * * *',
  $$UPDATE public.convites SET status='expirado'
     WHERE status='pendente' AND data_expiracao < now()$$
);
