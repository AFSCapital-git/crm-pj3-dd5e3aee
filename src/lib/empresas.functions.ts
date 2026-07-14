import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const empresaSchema = z.object({
  razao_social: z.string().min(1),
  cnpj: z.string().min(11),
  porte: z.enum(["ME", "EPP", "Grande"]),
  setor_atuacao: z.string().nullable().optional(),
  contato_responsavel: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  telefone: z.string().nullable().optional(),
  consultor_responsavel_id: z.string().uuid().nullable().optional(),
  status: z.enum(["lead", "ativo", "inativo"]).default("lead"),
});

export const listEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("empresas_clientes")
      .select("*, consultor:consultor_responsavel_id(id,nome,email)")
      .order("razao_social");
    if (error) throw error;
    return data;
  });

export const getEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("empresas_clientes")
      .select("*, consultor:consultor_responsavel_id(id,nome)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const upsertEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const parsed = z.object({
      id: z.string().uuid().optional(),
      values: empresaSchema,
    }).parse(d);
    return parsed;
  })
  .handler(async ({ data, context }) => {
    const values = {
      ...data.values,
      email: data.values.email || null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("empresas_clientes").update(values).eq("id", data.id).select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("empresas_clientes").insert(values).select().single();
    if (error) throw error;
    return row;
  });

export const deleteEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("empresas_clientes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
