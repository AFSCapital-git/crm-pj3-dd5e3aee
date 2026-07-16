import { formatBRL, formatDate, statusProjetoLabel, tipoMarcoLabel, prioridadeTarefaLabel } from "@/lib/labels";

export interface EmailContent {
  subject: string;
  html: string;
}

function baseLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; }
    a { color: #0f172a; text-decoration: none; }
    a:hover { text-decoration: underline; }
    p { margin: 0.5em 0; }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0f172a; margin-top: 0;">GestorFINEP</h2>
    <h3 style="color: #334155; margin-top: 1em;">${title}</h3>
    ${bodyHtml}
    <p style="margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      Este é um e-mail automático do GestorFINEP. Não responda.
    </p>
  </div>
</body>
</html>`;
}

export function marcoAtribuidoEmail(params: {
  responsavelNome: string;
  projetoNome: string;
  tipoMarco: string;
  dataPrevista: string;
  descricao?: string | null;
  urlProjeto: string;
}): EmailContent {
  const subject = `Novo marco atribuído — ${params.projetoNome}`;
  const body = `
    <p>Olá, <strong>${params.responsavelNome}</strong>.</p>
    <p>Você foi designado(a) responsável pelo marco <strong>${tipoMarcoLabel(params.tipoMarco)}</strong>
       do projeto <strong>${params.projetoNome}</strong>.</p>
    <p><strong>Data prevista:</strong> ${formatDate(params.dataPrevista)}</p>
    ${params.descricao ? `<p><strong>Descrição:</strong> ${params.descricao}</p>` : ""}
    <p><a href="${params.urlProjeto}" style="background-color: #0f172a; color: #fff; padding: 10px 16px; border-radius: 4px; display: inline-block; margin-top: 12px;">Ver projeto no GestorFINEP</a></p>
  `;
  return { subject, html: baseLayout(subject, body) };
}

export function projetoStatusEmail(params: {
  consultorNome: string;
  projetoNome: string;
  statusNovo: "aprovado" | "reprovado";
  valorAprovado?: number | null;
  urlProjeto: string;
}): EmailContent {
  const subject = `Projeto ${statusProjetoLabel(params.statusNovo)} — ${params.projetoNome}`;
  const body = `
    <p>Olá, <strong>${params.consultorNome}</strong>.</p>
    <p>O projeto <strong>${params.projetoNome}</strong> teve o status alterado para
       <strong>${statusProjetoLabel(params.statusNovo)}</strong>.</p>
    ${
      params.statusNovo === "aprovado" && params.valorAprovado
        ? `<p><strong>Valor aprovado:</strong> ${formatBRL(params.valorAprovado)}</p>`
        : ""
    }
    <p><a href="${params.urlProjeto}" style="background-color: #0f172a; color: #fff; padding: 10px 16px; border-radius: 4px; display: inline-block; margin-top: 12px;">Ver projeto no GestorFINEP</a></p>
  `;
  return { subject, html: baseLayout(subject, body) };
}

export function tarefaAtribuidaEmail(tarefa: any): EmailContent {
  const subject = `Nova tarefa atribuída: ${tarefa.titulo}`;
  const responsavelNome = tarefa.responsavel?.nome || "Usuário";
  const dataPrazo = tarefa.data_prazo ? formatDate(tarefa.data_prazo) : "—";
  const descricao = tarefa.descricao || "—";
  const prioridade = prioridadeTarefaLabel(tarefa.prioridade);
  const urlProjeto = `${process.env.APP_URL || ""}/projetos/${tarefa.projeto_id}`;

  const body = `
    <p>Olá, <strong>${responsavelNome}</strong>.</p>
    <p>Uma nova tarefa foi atribuída a você.</p>
    <p><strong>Título:</strong> ${tarefa.titulo}</p>
    <p><strong>Descrição:</strong> ${descricao}</p>
    <p><strong>Prioridade:</strong> ${prioridade}</p>
    <p><strong>Prazo:</strong> ${dataPrazo}</p>
    <p><a href="${urlProjeto}" style="background-color: #0f172a; color: #fff; padding: 10px 16px; border-radius: 4px; display: inline-block; margin-top: 12px;">Ver tarefa no GestorFINEP</a></p>
  `;
  return { subject, html: baseLayout(subject, body) };
}
