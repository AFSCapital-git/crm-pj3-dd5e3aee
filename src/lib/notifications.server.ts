// This file is server-only — handles email notifications for business events.
// Never import statically in *.functions.ts; always use dynamic import inside handlers.

export async function notificarMarcoAtribuido(marco: {
  id: string;
  projeto_id: string;
  responsavel_id: string | null;
  tipo: string;
  data_prevista: string;
  descricao: string | null;
}): Promise<void> {
  try {
    if (!marco.responsavel_id) return;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: responsavel }, { data: projeto }] = await Promise.all([
      supabaseAdmin
        .from("usuarios_internos")
        .select("nome,email")
        .eq("id", marco.responsavel_id)
        .maybeSingle(),
      supabaseAdmin
        .from("projetos")
        .select("nome_projeto")
        .eq("id", marco.projeto_id)
        .maybeSingle(),
    ]);

    if (!responsavel?.email || !projeto) return;

    const { sendEmail } = await import("@/lib/email.server");
    const { marcoAtribuidoEmail } = await import("@/lib/email-templates");

    const content = marcoAtribuidoEmail({
      responsavelNome: responsavel.nome,
      projetoNome: projeto.nome_projeto,
      tipoMarco: marco.tipo,
      dataPrevista: marco.data_prevista,
      descricao: marco.descricao,
      urlProjeto: `${process.env.APP_URL ?? ""}/projetos/${marco.projeto_id}`,
    });

    await sendEmail({
      to: responsavel.email,
      subject: content.subject,
      html: content.html,
    });
  } catch (err) {
    console.error("[email] erro ao enviar notificação de marco atribuído", err);
  }
}

export async function notificarProjetoStatus(projeto: {
  id: string;
  nome_projeto: string;
  empresa_cliente_id: string;
  status: string;
  valor_aprovado: number | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: empresa } = await supabaseAdmin
      .from("empresas_clientes")
      .select("consultor_responsavel_id")
      .eq("id", projeto.empresa_cliente_id)
      .maybeSingle();

    if (!empresa?.consultor_responsavel_id) return;

    const { data: consultor } = await supabaseAdmin
      .from("usuarios_internos")
      .select("nome,email")
      .eq("id", empresa.consultor_responsavel_id)
      .maybeSingle();

    if (!consultor?.email) return;

    const { sendEmail } = await import("@/lib/email.server");
    const { projetoStatusEmail } = await import("@/lib/email-templates");

    const content = projetoStatusEmail({
      consultorNome: consultor.nome,
      projetoNome: projeto.nome_projeto,
      statusNovo: projeto.status as "aprovado" | "reprovado",
      valorAprovado: projeto.valor_aprovado,
      urlProjeto: `${process.env.APP_URL ?? ""}/projetos/${projeto.id}`,
    });

    await sendEmail({
      to: consultor.email,
      subject: content.subject,
      html: content.html,
    });
  } catch (err) {
    console.error("[email] erro ao enviar notificação de status de projeto", err);
  }
}
