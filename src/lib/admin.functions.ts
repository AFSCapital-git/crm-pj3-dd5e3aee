import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- helpers ----------

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

function gerarSenhaTemporaria(): string {
  const maiusculas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const minusculas = "abcdefghijklmnopqrstuvwxyz";
  const digitos = "0123456789";
  const simbolos = "!@#$%^&*";
  const todos = maiusculas + minusculas + digitos + simbolos;

  let senha = "";
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += minusculas[Math.floor(Math.random() * minusculas.length)];
  senha += digitos[Math.floor(Math.random() * digitos.length)];
  senha += simbolos[Math.floor(Math.random() * simbolos.length)];

  for (let i = 0; i < 8; i++) {
    senha += todos[Math.floor(Math.random() * todos.length)];
  }

  return senha.split("").sort(() => Math.random() - 0.5).join("");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Error("Acesso restrito: apenas administradores.");
}

// ---------- convites ----------

export const listConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("convites")
      .select(
        "id,email_convidado,papel_designado,nome_sugerido,status,data_expiracao,criado_em,aceito_em,convidado_por,usuario_criado_id",
      )
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        papel: z.enum(["admin", "coordenador", "projetista"]),
        nome: z.string().trim().max(120).optional(),
        coordenador_id: z.string().uuid().nullable().optional(),
        ve_todos_projetos: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Já existe usuário ativo com esse e-mail?
    const { data: existente } = await supabaseAdmin
      .from("usuarios_internos")
      .select("id,status")
      .eq("email", data.email)
      .maybeSingle();
    if (existente && existente.status !== "desativado") {
      throw new Error("Já existe um usuário ativo com esse e-mail.");
    }

    // Já existe convite pendente para esse e-mail?
    const { data: pend } = await supabaseAdmin
      .from("convites")
      .select("id")
      .eq("email_convidado", data.email)
      .eq("status", "pendente")
      .maybeSingle();
    if (pend) {
      throw new Error(
        "Já existe um convite pendente para esse e-mail. Reenvie ou revogue o convite existente.",
      );
    }

    const token = newToken();
    const token_hash = await sha256Hex(token);
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: convite, error } = await supabaseAdmin
      .from("convites")
      .insert({
        email_convidado: data.email,
        papel_designado: data.papel,
        nome_sugerido: data.nome ?? null,
        token_hash,
        data_expiracao: expira,
        status: "pendente",
        convidado_por: context.userId,
        coordenador_id: data.coordenador_id ?? null,
        ve_todos_projetos: data.ve_todos_projetos ?? false,
      })
      .select("id,email_convidado,papel_designado,data_expiracao")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: context.userId,
      acao: "convite_enviado",
      convite_id: convite.id,
      detalhes_da_acao: {
        email: data.email,
        papel: data.papel,
        coordenador_id: data.coordenador_id,
        ve_todos_projetos: data.ve_todos_projetos,
      },
    });

    return { convite, token };
  });

export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: atual, error: e1 } = await supabaseAdmin
      .from("convites")
      .select("id,status,email_convidado,papel_designado")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw e1;
    if (!atual) throw new Error("Convite não encontrado.");
    if (atual.status !== "pendente" && atual.status !== "expirado") {
      throw new Error("Este convite não pode ser reenviado (já aceito ou revogado).");
    }

    const token = newToken();
    const token_hash = await sha256Hex(token);
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: e2 } = await supabaseAdmin
      .from("convites")
      .update({
        token_hash,
        data_expiracao: expira,
        status: "pendente",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (e2) throw e2;

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: context.userId,
      acao: "convite_reenviado",
      convite_id: data.id,
      detalhes_da_acao: { email: atual.email_convidado },
    });

    return { token, email: atual.email_convidado, papel: atual.papel_designado };
  });

export const revogarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: atual } = await supabaseAdmin
      .from("convites")
      .select("email_convidado,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!atual) throw new Error("Convite não encontrado.");
    if (atual.status === "aceito") throw new Error("Convite já foi aceito.");

    const { error } = await supabaseAdmin
      .from("convites")
      .update({ status: "revogado", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: context.userId,
      acao: "convite_revogado",
      convite_id: data.id,
      detalhes_da_acao: { email: atual.email_convidado },
    });
    return { ok: true };
  });

// ---------- aceite público ----------

export const validarConvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token_hash = await sha256Hex(data.token);
    const { data: c } = await supabaseAdmin
      .from("convites")
      .select("id,email_convidado,papel_designado,nome_sugerido,status,data_expiracao")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!c) return { valid: false as const, motivo: "Convite inválido." };
    if (c.status !== "pendente") return { valid: false as const, motivo: `Convite ${c.status}.` };
    if (new Date(c.data_expiracao).getTime() < Date.now()) {
      return { valid: false as const, motivo: "Convite expirado." };
    }
    return {
      valid: true as const,
      email: c.email_convidado,
      papel: c.papel_designado,
      nome_sugerido: c.nome_sugerido,
      expira_em: c.data_expiracao,
    };
  });

export const aceitarConvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10),
        nome: z.string().trim().min(2).max(120),
        senha: z.string().min(8).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token_hash = await sha256Hex(data.token);

    const { data: c, error: e1 } = await supabaseAdmin
      .from("convites")
      .select("id,email_convidado,papel_designado,status,data_expiracao,convidado_por")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (e1) throw e1;
    if (!c) throw new Error("Convite inválido.");
    if (c.status !== "pendente") throw new Error(`Convite ${c.status}.`);
    if (new Date(c.data_expiracao).getTime() < Date.now()) {
      await supabaseAdmin.from("convites").update({ status: "expirado" }).eq("id", c.id);
      throw new Error("Convite expirado.");
    }

    // Cria usuário no Auth
    const { data: created, error: e2 } = await supabaseAdmin.auth.admin.createUser({
      email: c.email_convidado,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (e2 || !created?.user) throw new Error(e2?.message ?? "Falha ao criar usuário.");
    const newUserId = created.user.id;

    // O trigger handle_new_user já cria usuarios_internos + role default.
    // Ajusta status, nome, convidado_por, coordenador_id, ve_todos_projetos e papel correto.
    await supabaseAdmin
      .from("usuarios_internos")
      .update({
        nome: data.nome,
        status: "ativo",
        convidado_por: c.convidado_por,
        coordenador_id: c.coordenador_id,
        ve_todos_projetos: c.ve_todos_projetos,
      })
      .eq("id", newUserId);

    // Substitui roles pelo papel do convite
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: e3 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: c.papel_designado });
    if (e3) throw e3;

    await supabaseAdmin
      .from("convites")
      .update({
        status: "aceito",
        aceito_em: new Date().toISOString(),
        usuario_criado_id: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: newUserId,
      acao: "convite_aceito",
      convite_id: c.id,
      usuario_afetado: newUserId,
      detalhes_da_acao: { email: c.email_convidado, papel: c.papel_designado },
    });

    return { ok: true, email: c.email_convidado };
  });

// ---------- gestão de usuários ----------

export const alterarPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        papel: z.enum(["admin", "coordenador", "projetista"]),
        coordenador_id: z.string().uuid().nullable().optional(),
        ve_todos_projetos: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rolesAtuais } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const antes = (rolesAtuais ?? []).map((r) => r.role).join(",");

    // Se está tirando admin, o trigger BEFORE DELETE valida "último admin".
    const { error: eDel } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (eDel) throw eDel;

    const { error: eIns } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.papel });
    if (eIns) {
      if (antes)
        await supabaseAdmin
          .from("user_roles")
          .insert(antes.split(",").map((r) => ({ user_id: data.user_id, role: r as any })));
      throw eIns;
    }

    const updateData: Record<string, any> = {};
    if (data.coordenador_id !== undefined) updateData.coordenador_id = data.coordenador_id;
    if (data.ve_todos_projetos !== undefined) updateData.ve_todos_projetos = data.ve_todos_projetos;
    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin.from("usuarios_internos").update(updateData).eq("id", data.user_id);
    }

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: context.userId,
      acao: "papel_alterado",
      usuario_afetado: data.user_id,
      detalhes_da_acao: {
        de: antes || null,
        para: data.papel,
        coordenador_id: data.coordenador_id,
        ve_todos_projetos: data.ve_todos_projetos,
      },
    });
    return { ok: true };
  });

export const criarUsuarioDireto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        papel: z.enum(["admin", "coordenador", "projetista"]),
        coordenador_id: z.string().uuid().nullable().optional(),
        ve_todos_projetos: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Já existe usuário ativo com esse e-mail?
    const { data: existente } = await supabaseAdmin
      .from("usuarios_internos")
      .select("id,status")
      .eq("email", data.email)
      .maybeSingle();
    if (existente && existente.status !== "desativado") {
      throw new Error("Já existe um usuário ativo com esse e-mail.");
    }

    const senhaTemporaria = gerarSenhaTemporaria();

    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: senhaTemporaria,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (e1 || !created?.user) throw new Error(e1?.message ?? "Falha ao criar usuário.");
    const newUserId = created.user.id;

    await supabaseAdmin
      .from("usuarios_internos")
      .update({
        nome: data.nome,
        status: "ativo",
        senha_temporaria: true,
        convidado_por: context.userId,
        coordenador_id: data.coordenador_id ?? null,
        ve_todos_projetos: data.ve_todos_projetos ?? false,
      })
      .eq("id", newUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.papel });
    if (e2) throw e2;

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: context.userId,
      acao: "usuario_criado_direto",
      usuario_afetado: newUserId,
      detalhes_da_acao: {
        email: data.email,
        papel: data.papel,
        coordenador_id: data.coordenador_id,
        ve_todos_projetos: data.ve_todos_projetos,
      },
    });

    return { senhaTemporaria, email: data.email };
  });

export const setUsuarioStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        status: z.enum(["ativo", "desativado"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Trigger BEFORE UPDATE OF status protege "último admin ativo"
    const { error } = await supabaseAdmin
      .from("usuarios_internos")
      .update({ status: data.status })
      .eq("id", data.user_id);
    if (error) throw error;

    if (data.status === "desativado") {
      // Invalida sessão imediatamente
      try {
        await supabaseAdmin.auth.admin.signOut(data.user_id, "global");
      } catch (e) {
        console.error("[admin] signOut falhou (não crítico):", e);
      }
    }

    await supabaseAdmin.from("log_auditoria_admin").insert({
      usuario_que_executou: context.userId,
      acao: data.status === "ativo" ? "usuario_reativado" : "usuario_desativado",
      usuario_afetado: data.user_id,
      detalhes_da_acao: { status: data.status },
    });
    return { ok: true };
  });

export const listLogAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        usuario_id: z.string().uuid().optional(),
        acao: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("log_auditoria_admin")
      .select("id,acao,detalhes_da_acao,data_hora,usuario_que_executou,usuario_afetado,convite_id")
      .order("data_hora", { ascending: false })
      .limit(data.limit);
    if (data.usuario_id) {
      q = q.or(`usuario_que_executou.eq.${data.usuario_id},usuario_afetado.eq.${data.usuario_id}`);
    }
    if (data.acao) q = q.eq("acao", data.acao);
    const { data: logs, error } = await q;
    if (error) throw error;

    // Junta nomes
    const ids = new Set<string>();
    for (const l of logs ?? []) {
      if (l.usuario_que_executou) ids.add(l.usuario_que_executou);
      if (l.usuario_afetado) ids.add(l.usuario_afetado);
    }
    const nomes: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: us } = await context.supabase
        .from("usuarios_internos")
        .select("id,nome,email")
        .in("id", [...ids]);
      for (const u of us ?? []) nomes[u.id] = u.nome || u.email;
    }
    return (logs ?? []).map((l) => ({
      ...l,
      executor_nome: l.usuario_que_executou ? (nomes[l.usuario_que_executou] ?? "—") : "sistema",
      afetado_nome: l.usuario_afetado ? (nomes[l.usuario_afetado] ?? "—") : null,
    }));
  });

export const registrarLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("usuarios_internos")
      .update({ ultimo_login: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) console.error("[registrarLogin]", error);
    return { ok: true };
  });

export const meuStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("usuarios_internos")
      .select("status")
      .eq("id", context.userId)
      .maybeSingle();
    return { status: (data?.status as string | undefined) ?? "ativo" };
  });
