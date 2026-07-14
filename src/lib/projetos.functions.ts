import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS = [
  "em_elaboracao","submetido","em_analise","aprovado","contratado",
  "em_execucao","em_prestacao_contas","encerrado","reprovado",
] as const;

const projetoSchema = z.object({
  empresa_cliente_id: z.string().uuid(),
  linha_edital_id: z.string().uuid().nullable().optional(),
  nome_projeto: z.string().min(1),
  valor_solicitado: z.number().nullable().optional(),
  valor_aprovado: z.number().nullable().optional(),
  status: z.enum(STATUS),
  data_submissao: z.string().nullable().optional(),
  prazo_execucao_meses: z.number().int().nullable().optional(),
  area_tecnologica: z.string().nullable().optional(),
});

export const listProjetos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projetos")
      .select("*, empresa:empresa_cliente_id(id,razao_social,consultor_responsavel_id), edital:linha_edital_id(id,nome,categoria)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const getProjeto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: projeto, error } = await context.supabase
      .from("projetos")
      .select("*, empresa:empresa_cliente_id(id,razao_social,cnpj,consultor_responsavel_id), edital:linha_edital_id(id,nome,categoria,orgao)")
      .eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!projeto) return null;

    const [{ data: marcos }, { data: interacoes }] = await Promise.all([
      context.supabase.from("marcos_com_urgencia").select("*").eq("projeto_id", data.id).order("data_prevista"),
      context.supabase.from("interacoes").select("*, autor:usuario_id(id,nome)").eq("projeto_id", data.id).order("data_hora", { ascending: false }),
    ]);
    return { projeto, marcos: marcos ?? [], interacoes: interacoes ?? [] };
  });

export const upsertProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    values: projetoSchema,
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("projetos").update(data.values).eq("id", data.id).select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("projetos").insert(data.values).select().single();
    if (error) throw error;
    return row;
  });

export const deleteProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projetos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
