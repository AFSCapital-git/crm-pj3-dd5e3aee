import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEmailsProjeto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projeto_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("emails_vinculados")
      .select("*")
      .eq("projeto_id", data.projeto_id)
      .order("data_email_original", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return rows ?? [];
  });

export const listEmailsPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("emails_nao_vinculados")
      .select("*")
      .eq("resolvido", false)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const vincularEmailManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pendente_id: z.string().uuid(), projeto_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("vincular_email_manual", {
      _pendente_id: data.pendente_id,
      _projeto_id: data.projeto_id,
    });
    if (error) throw error;
    return row;
  });

export const descartarEmailPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("emails_nao_vinculados")
      .update({ resolvido: true })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Simula um reencaminhamento para demonstrar a deduplicação por hash de conteúdo.
// Chama duas vezes com o MESMO payload; a 2ª chamada deve retornar status "duplicate".
export const simularReencaminhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projeto_id: z.string().uuid(), codigo_rastreio: z.string().min(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Só admin pode simular (evita ruído no histórico real).
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem simular reencaminhamento");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const from = "teste-dedup@gestorfinep.app";
    const subject = `[TESTE DEDUP ${data.codigo_rastreio}] Simulação de reencaminhamento`;
    const text = `Este é um e-mail sintético gerado em ${now.toISOString()} para validar a deduplicação por hash de conteúdo. Reencaminhamentos idênticos NÃO devem criar novos registros.`;
    const dateStr = now.toISOString();
    const messageId = `<sim-${now.getTime()}@gestorfinep.local>`;
    const hash = createHash("sha256").update(`mid:${messageId}`).digest("hex");

    const payload = {
      projeto_id: data.projeto_id,
      remetente_original: from,
      assunto: subject,
      corpo_texto: text,
      data_email_original: dateStr,
      anexos_referenciados: [],
      message_id: messageId,
      dedup_hash: hash,
    };

    const attempt = async () => {
      const existing = await supabaseAdmin
        .from("emails_vinculados")
        .select("id")
        .eq("projeto_id", data.projeto_id)
        .eq("dedup_hash", hash)
        .maybeSingle();
      if (existing.data) return { status: "duplicate" as const, email_id: existing.data.id };
      const ins = await supabaseAdmin
        .from("emails_vinculados")
        .insert(payload as any)
        .select("id")
        .maybeSingle();
      if (ins.error) {
        const errorObj = ins.error as unknown as Record<string, unknown>;
        const dup =
          errorObj.code === "23505" ||
          String(ins.error.message ?? "")
            .toLowerCase()
            .includes("duplicate");
        if (dup) return { status: "duplicate" as const };
        throw ins.error;
      }
      return { status: "linked" as const, email_id: ins.data?.id };
    };

    const first = await attempt();
    const second = await attempt();
    return { dedup_hash: hash, message_id: messageId, first, second };
  });
