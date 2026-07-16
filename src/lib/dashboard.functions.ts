import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [{ data: projetos }, { data: marcos }] = await Promise.all([
      supabase.from("projetos").select("id,status,valor_aprovado"),
      supabase
        .from("marcos_com_urgencia")
        .select("*")
        .neq("urgencia", "ok")
        .order("data_prevista", { ascending: true })
        .limit(200),
    ]);

    const projetosList = projetos ?? [];
    const marcosList = marcos ?? [];

    const statusCount: Record<string, number> = {};
    let valorCaptado = 0;
    let submetidos = 0;
    let aprovados = 0;
    const ativosSet = new Set(["aprovado", "contratado", "em_execucao", "em_prestacao_contas"]);
    const submetidosSet = new Set([
      "submetido",
      "em_analise",
      "aprovado",
      "contratado",
      "em_execucao",
      "em_prestacao_contas",
      "encerrado",
      "reprovado",
    ]);
    const aprovadosSet = new Set([
      "aprovado",
      "contratado",
      "em_execucao",
      "em_prestacao_contas",
      "encerrado",
    ]);

    for (const p of projetosList) {
      statusCount[p.status] = (statusCount[p.status] ?? 0) + 1;
      if (ativosSet.has(p.status) && p.valor_aprovado) valorCaptado += Number(p.valor_aprovado);
      if (submetidosSet.has(p.status)) submetidos++;
      if (aprovadosSet.has(p.status)) aprovados++;
    }

    const counters = {
      vencido: marcosList.filter((m) => m.urgencia === "vencido").length,
      critico_7: marcosList.filter((m) => m.urgencia === "critico_7").length,
      alerta_15: marcosList.filter((m) => m.urgencia === "alerta_15").length,
      aviso_30: marcosList.filter((m) => m.urgencia === "aviso_30").length,
    };

    return {
      valorCaptado,
      totalProjetos: projetosList.length,
      statusCount,
      taxaAprovacao: submetidos > 0 ? aprovados / submetidos : 0,
      marcos: marcosList,
      counters,
    };
  });

export const getCronograma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("marcos_com_urgencia")
      .select("*")
      .order("data_prevista", { ascending: true })
      .limit(1000);
    if (error) throw error;
    return data ?? [];
  });

export const exportProjetosCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: projetos }, { data: marcos }] = await Promise.all([
      context.supabase
        .from("projetos")
        .select(
          "id,nome_projeto,status,valor_solicitado,valor_aprovado,data_submissao,prazo_execucao_meses,empresa:empresa_cliente_id(razao_social,cnpj)",
        ),
      context.supabase.from("marcos_com_urgencia").select("*"),
    ]);

    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };

    const projHeader = [
      "ID",
      "Projeto",
      "Empresa",
      "CNPJ",
      "Status",
      "Valor Solicitado",
      "Valor Aprovado",
      "Data Submissão",
      "Prazo (meses)",
    ];
    const projRows = (projetos ?? []).map((p: Record<string, unknown>) => [
      p.id,
      p.nome_projeto,
      (p.empresa as Record<string, unknown> | undefined)?.razao_social ?? "",
      (p.empresa as Record<string, unknown> | undefined)?.cnpj ?? "",
      p.status,
      p.valor_solicitado ?? "",
      p.valor_aprovado ?? "",
      p.data_submissao ?? "",
      p.prazo_execucao_meses ?? "",
    ]);

    const marcoHeader = [
      "Projeto ID",
      "Projeto",
      "Empresa",
      "Tipo",
      "Data Prevista",
      "Data Entrega Real",
      "Status",
      "Urgência",
      "Dias p/ vencer",
    ];
    const marcoRows = (marcos ?? []).map((m: Record<string, unknown>) => [
      m.projeto_id,
      m.nome_projeto,
      m.empresa_razao_social,
      m.tipo,
      m.data_prevista,
      m.data_entrega_real ?? "",
      m.status,
      m.urgencia,
      m.dias_para_vencer,
    ]);

    const csv =
      "PROJETOS\n" +
      [projHeader, ...projRows].map((r) => r.map(esc).join(",")).join("\n") +
      "\n\nMARCOS/ENTREGAS\n" +
      [marcoHeader, ...marcoRows].map((r) => r.map(esc).join(",")).join("\n");

    return { csv, filename: `gestorfinep-${new Date().toISOString().slice(0, 10)}.csv` };
  });

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Validar que usuário é admin antes de retornar lista
    const { data: userRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (userRole?.role !== "admin") {
      throw new Error("Acesso negado. Apenas administradores podem listar usuários.");
    }

    const [{ data: users }, { data: roles }] = await Promise.all([
      context.supabase.from("usuarios_internos").select("*").order("nome").limit(100),
      context.supabase.from("user_roles").select("user_id,role").limit(500),
    ]);
    const byUser: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      byUser[r.user_id] ??= [];
      byUser[r.user_id].push(r.role);
    }
    return (users ?? []).map((u) => ({
      ...u,
      roles: byUser[u.id] ?? [],
    }));
  });

export const reassignEmpresasConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from_user_id: z.string().uuid(),
        to_user_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("empresas_clientes")
      .update({ consultor_responsavel_id: data.to_user_id })
      .eq("consultor_responsavel_id", data.from_user_id)
      .select("id");
    if (error) throw error;
    return { count: rows?.length ?? 0 };
  });
