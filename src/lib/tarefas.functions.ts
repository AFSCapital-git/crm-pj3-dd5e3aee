import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tarefaSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
  status: z
    .enum(["pendente", "em_andamento", "concluida", "cancelada"])
    .default("pendente"),
  data_prazo: z.string().nullable().optional(),
  origem_discussao_id: z.string().uuid().nullable().optional(),
});

export const listTarefas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projeto_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: tarefas, error } = await context.supabase
      .from("tarefas_projeto")
      .select("*, responsavel:responsavel_id(id,nome)")
      .eq("projeto_id", data.projeto_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return tarefas ?? [];
  });

export const upsertTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        projeto_id: z.string().uuid(),
        values: tarefaSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("tarefas_projeto")
        .update(data.values)
        .eq("id", data.id)
        .select("*, responsavel:responsavel_id(id,nome)")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("tarefas_projeto")
      .insert({ projeto_id: data.projeto_id, ...data.values })
      .select("*, responsavel:responsavel_id(id,nome)")
      .single();
    if (error) throw error;

    if (data.values.responsavel_id) {
      try {
        const { notificarTarefaAtribuida } = await import(
          "@/lib/notifications.server"
        );
        await notificarTarefaAtribuida(row);
      } catch (e) {
        console.error(e);
      }
    }

    return row;
  });

export const concluirTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tarefas_projeto")
      .update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*, responsavel:responsavel_id(id,nome)")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tarefas_projeto")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getTarefa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: tarefa, error } = await context.supabase
      .from("tarefas_projeto")
      .select("*, responsavel:responsavel_id(id,nome)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return tarefa ?? null;
  });
