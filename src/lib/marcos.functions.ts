import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const marcoSchema = z.object({
  projeto_id: z.string().uuid(),
  tipo: z.enum([
    "relatorio_tecnico",
    "relatorio_financeiro",
    "prestacao_contas_parcial",
    "prestacao_contas_final",
  ]),
  descricao: z.string().nullable().optional(),
  data_prevista: z.string(),
  responsavel_id: z.string().uuid().nullable().optional(),
});

export const upsertMarco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        values: marcoSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("marcos_entregas")
        .update(data.values)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("marcos_entregas")
      .insert(data.values)
      .select()
      .single();
    if (error) throw error;

    if (data.values.responsavel_id) {
      try {
        const { notificarMarcoAtribuido } = await import("@/lib/notifications.server");
        await notificarMarcoAtribuido(row);
      } catch (err) {
        console.error("[email] erro ao notificar marco atribuído", err);
      }
    }

    return row;
  });

export const marcarEntregue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        data_entrega_real: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("marcos_entregas")
      .update({ data_entrega_real: data.data_entrega_real, status: "entregue" })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteMarco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("marcos_entregas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const createInteracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projeto_id: z.string().uuid(),
        tipo: z.enum([
          "reuniao",
          "email",
          "ligacao",
          "alteracao_cronograma",
          "aditivo_contratual",
          "nota",
        ]),
        descricao: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("interacoes")
      .insert({ ...data, usuario_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });
