import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const editalSchema = z.object({
  nome: z.string().min(1),
  categoria: z.enum(["subvencao_economica", "reembolsavel", "RHAE", "outro"]),
  orgao: z.string().nullable().optional(),
  valor_maximo_edital: z.number().nullable().optional(),
  prazo_submissao: z.string().nullable().optional(),
  requisitos_elegibilidade: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
});

export const listEditais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("linhas_editais_finep")
      .select("*")
      .order("prazo_submissao", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  });

export const upsertEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        values: editalSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("linhas_editais_finep")
        .update(data.values)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("linhas_editais_finep")
      .insert(data.values)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("linhas_editais_finep")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
