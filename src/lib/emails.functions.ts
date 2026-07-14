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
    z.object({ pendente_id: z.string().uuid(), projeto_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("vincular_email_manual", {
      _pendente_id: data.pendente_id,
      _projeto_id: data.projeto_id,
    } as any);
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
