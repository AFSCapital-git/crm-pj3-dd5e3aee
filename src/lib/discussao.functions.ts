import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listDiscussao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projeto_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: mensagens, error } = await context.supabase
      .from("discussao_mensagens")
      .select("*, autor:autor_id(id,nome)")
      .eq("projeto_id", data.projeto_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return mensagens ?? [];
  });

export const createMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projeto_id: z.string().uuid(),
        mensagem: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("discussao_mensagens")
      .insert({
        projeto_id: data.projeto_id,
        mensagem: data.mensagem,
        autor_id: context.userId,
      })
      .select("*, autor:autor_id(id,nome)")
      .single();
    if (error) throw error;
    return row;
  });

export const updateMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        mensagem: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("discussao_mensagens")
      .update({ mensagem: data.mensagem, editado_em: new Date().toISOString() })
      .eq("id", data.id)
      .select("*, autor:autor_id(id,nome)")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("discussao_mensagens")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
