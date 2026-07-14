import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const ATIVOS = [
  "em_elaboracao","submetido","em_analise","aprovado","contratado","em_execucao","em_prestacao_contas",
] as const;

async function callLovableAI(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.4 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de requisições da IA atingido. Tente novamente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    throw new Error(`Falha na IA (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  return json?.choices?.[0]?.message?.content as string ?? "";
}

async function montarResumoPortfolio(supabase: any) {
  const { data: projetos } = await supabase
    .from("projetos")
    .select("id,nome_projeto,status,valor_solicitado,valor_aprovado,data_submissao,prazo_execucao_meses,area_tecnologica,empresa:empresa_cliente_id(razao_social)")
    .in("status", ATIVOS as unknown as string[]);

  const ids = (projetos ?? []).map((p: any) => p.id);
  if (ids.length === 0) return { projetos: [], marcos: [], interacoes: [], emails: [] };

  const [{ data: marcos }, { data: interacoes }, { data: emails }] = await Promise.all([
    supabase.from("marcos_com_urgencia").select("projeto_id,tipo,data_prevista,data_entrega_real,urgencia,dias_para_vencer").in("projeto_id", ids),
    supabase.from("interacoes").select("projeto_id,tipo,descricao,data_hora").in("projeto_id", ids).order("data_hora", { ascending: false }).limit(200),
    supabase.from("emails_vinculados").select("projeto_id,assunto,remetente_original,data_email_original,corpo_texto").in("projeto_id", ids).order("data_email_original", { ascending: false }).limit(60),
  ]);

  return { projetos: projetos ?? [], marcos: marcos ?? [], interacoes: interacoes ?? [], emails: emails ?? [] };
}

function resumirParaPrompt(bundle: any) {
  const linhas: string[] = [];
  for (const p of bundle.projetos) {
    linhas.push(`\n### Projeto: ${p.nome_projeto} (id: ${p.id})`);
    linhas.push(`- Empresa: ${p.empresa?.razao_social ?? "—"}`);
    linhas.push(`- Status: ${p.status} | Área: ${p.area_tecnologica ?? "—"}`);
    linhas.push(`- Valor solicitado: ${p.valor_solicitado ?? "—"} | Aprovado: ${p.valor_aprovado ?? "—"}`);
    linhas.push(`- Submissão: ${p.data_submissao ?? "—"} | Prazo: ${p.prazo_execucao_meses ?? "—"} meses`);
    const marcos = bundle.marcos.filter((m: any) => m.projeto_id === p.id);
    if (marcos.length) {
      linhas.push(`- Marcos:`);
      for (const m of marcos.slice(0, 8)) {
        linhas.push(`  • ${m.tipo} prev ${m.data_prevista} entregue ${m.data_entrega_real ?? "não"} urgência=${m.urgencia} (${m.dias_para_vencer}d)`);
      }
    }
    const inters = bundle.interacoes.filter((i: any) => i.projeto_id === p.id).slice(0, 5);
    if (inters.length) {
      linhas.push(`- Últimas interações:`);
      for (const i of inters) linhas.push(`  • [${i.tipo} @ ${i.data_hora.slice(0,10)}] ${String(i.descricao).slice(0, 160)}`);
    }
    const mails = bundle.emails.filter((e: any) => e.projeto_id === p.id).slice(0, 3);
    if (mails.length) {
      linhas.push(`- E-mails recentes:`);
      for (const e of mails) linhas.push(`  • "${e.assunto ?? ""}" de ${e.remetente_original} — ${String(e.corpo_texto ?? "").slice(0, 200)}`);
    }
  }
  return linhas.join("\n");
}

export const listInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    projeto_id: z.string().uuid().nullable().optional(),
    tipo: z.enum(["alerta_risco","sugestao","rascunho_relatorio"]).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("insights_ia" as any)
      .select("*")
      .order("gerado_em", { ascending: false })
      .limit(100);
    if (data.projeto_id === null) q = q.is("projeto_id", null);
    else if (data.projeto_id) q = q.eq("projeto_id", data.projeto_id);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const gerarInsightsPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bundle = await montarResumoPortfolio(context.supabase);
    if (!bundle.projetos.length) throw new Error("Nenhum projeto ativo para analisar.");
    const resumo = resumirParaPrompt(bundle);

    const conteudo = await callLovableAI([
      { role: "system", content: "Você é um assistente sênior de gestão de portfólio de projetos FINEP. Escreva em português do Brasil, seja objetivo e cite os projetos pelo nome. Nunca invente dados; use apenas o que está no resumo." },
      { role: "user", content:
`Com base nestes dados de projetos em andamento, produza uma análise estruturada em markdown com:

(a) **Projetos em risco de atraso** — liste cada um com justificativa (marcos vencidos, urgência, sinais nos e-mails)
(b) **Padrões observados** — semelhanças entre projetos, tipos de risco recorrentes
(c) **Sugestões de próximos passos** — ações concretas por projeto em risco

Dados:
${resumo}` },
    ]);

    const { data: row, error } = await context.supabase
      .from("insights_ia" as any)
      .insert({
        projeto_id: null,
        tipo: "alerta_risco",
        titulo: `Análise de portfólio — ${new Date().toLocaleDateString("pt-BR")}`,
        conteudo_gerado: conteudo,
        modelo: MODEL,
        input_resumo: { total_projetos: bundle.projetos.length, total_marcos: bundle.marcos.length },
        gerado_por: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const gerarRascunhoRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projeto_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: projeto } = await context.supabase
      .from("projetos")
      .select("*, empresa:empresa_cliente_id(razao_social,cnpj), edital:linha_edital_id(nome,orgao)")
      .eq("id", data.projeto_id).maybeSingle();
    if (!projeto) throw new Error("Projeto não encontrado");

    const [{ data: marcos }, { data: interacoes }, { data: emails }] = await Promise.all([
      context.supabase.from("marcos_com_urgencia").select("*").eq("projeto_id", data.projeto_id),
      context.supabase.from("interacoes").select("tipo,descricao,data_hora").eq("projeto_id", data.projeto_id).order("data_hora", { ascending: false }).limit(30),
      context.supabase.from("emails_vinculados").select("assunto,remetente_original,data_email_original,corpo_texto").eq("projeto_id", data.projeto_id).order("data_email_original", { ascending: false }).limit(15),
    ]);

    const p: any = projeto;
    const dados =
`Projeto: ${p.nome_projeto}
Empresa: ${p.empresa?.razao_social} (CNPJ ${p.empresa?.cnpj})
Edital: ${p.edital?.nome ?? "—"} / ${p.edital?.orgao ?? "—"}
Status: ${p.status}
Valor solicitado: ${p.valor_solicitado ?? "—"} | Aprovado: ${p.valor_aprovado ?? "—"}
Submissão: ${p.data_submissao ?? "—"} | Prazo: ${p.prazo_execucao_meses ?? "—"} meses

Marcos:
${(marcos ?? []).map((m: any) => `- ${m.tipo}: previsto ${m.data_prevista} | entregue ${m.data_entrega_real ?? "não"} | urgência ${m.urgencia}`).join("\n") || "—"}

Últimas interações:
${(interacoes ?? []).map((i: any) => `- [${i.tipo} ${i.data_hora.slice(0,10)}] ${i.descricao}`).join("\n") || "—"}

E-mails recentes:
${(emails ?? []).map((e: any) => `- "${e.assunto}" de ${e.remetente_original} (${String(e.data_email_original).slice(0,10)}): ${String(e.corpo_texto ?? "").slice(0, 300)}`).join("\n") || "—"}`;

    const conteudo = await callLovableAI([
      { role: "system", content: "Você redige rascunhos de relatório de andamento de projetos FINEP em português do Brasil. Use apenas os dados fornecidos, sem inventar informações. Estruture em seções: 1) Contextualização, 2) Marcos concluídos, 3) Marcos pendentes/atrasados, 4) Execução financeira, 5) Principais comunicações, 6) Próximos passos. Ao final, inclua a linha: '⚠️ RASCUNHO gerado por IA — requer revisão humana antes de qualquer envio.'" },
      { role: "user", content: `Elabore o rascunho de relatório com base nestes dados:\n\n${dados}` },
    ]);

    const { data: row, error } = await context.supabase
      .from("insights_ia" as any)
      .insert({
        projeto_id: data.projeto_id,
        tipo: "rascunho_relatorio",
        titulo: `Rascunho de relatório — ${p.nome_projeto} — ${new Date().toLocaleDateString("pt-BR")}`,
        conteudo_gerado: conteudo,
        modelo: MODEL,
        input_resumo: { marcos: (marcos ?? []).length, interacoes: (interacoes ?? []).length, emails: (emails ?? []).length },
        gerado_por: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const revisarInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    aprovado: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("insights_ia" as any)
      .update({
        revisado_por_humano: true,
        aprovado: data.aprovado,
        revisado_por: context.userId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("insights_ia" as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
