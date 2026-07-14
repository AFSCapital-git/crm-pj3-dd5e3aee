import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Urgencia = "vencido" | "critico_7" | "alerta_15" | "aviso_30" | "ok";

const map: Record<Urgencia, { label: string; cls: string }> = {
  vencido:    { label: "Vencido",       cls: "bg-urgency-overdue text-urgency-overdue-fg border-transparent" },
  critico_7:  { label: "≤ 7 dias",       cls: "bg-urgency-critical text-urgency-critical-fg border-transparent" },
  alerta_15:  { label: "≤ 15 dias",      cls: "bg-urgency-warning text-urgency-warning-fg border-transparent" },
  aviso_30:   { label: "≤ 30 dias",      cls: "bg-urgency-notice text-urgency-notice-fg border-transparent" },
  ok:         { label: "Em dia",         cls: "bg-urgency-ok text-urgency-ok-fg border-transparent" },
};

export function UrgencyBadge({ urgencia, className }: { urgencia: Urgencia; className?: string }) {
  const m = map[urgencia] ?? map.ok;
  return <Badge className={cn(m.cls, className)}>{m.label}</Badge>;
}

const statusLabels: Record<string, string> = {
  em_elaboracao: "Em elaboração",
  submetido: "Submetido",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  contratado: "Contratado",
  em_execucao: "Em execução",
  em_prestacao_contas: "Em prestação de contas",
  encerrado: "Encerrado",
  reprovado: "Reprovado",
};
export function statusProjetoLabel(s: string) { return statusLabels[s] ?? s; }

const tipoMarcoLabels: Record<string, string> = {
  relatorio_tecnico: "Relatório técnico",
  relatorio_financeiro: "Relatório financeiro",
  prestacao_contas_parcial: "Prestação de contas parcial",
  prestacao_contas_final: "Prestação de contas final",
};
export function tipoMarcoLabel(s: string) { return tipoMarcoLabels[s] ?? s; }

const categoriaEditalLabels: Record<string, string> = {
  subvencao_economica: "Subvenção Econômica",
  reembolsavel: "Reembolsável",
  RHAE: "RHAE",
  outro: "Outro",
};
export function categoriaEditalLabel(s: string) { return categoriaEditalLabels[s] ?? s; }

const tipoInteracaoLabels: Record<string, string> = {
  reuniao: "Reunião",
  email: "E-mail",
  ligacao: "Ligação",
  alteracao_cronograma: "Alteração de cronograma",
  aditivo_contratual: "Aditivo contratual",
  nota: "Nota",
};
export function tipoInteracaoLabel(s: string) { return tipoInteracaoLabels[s] ?? s; }

export function formatBRL(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  const [y, m, d] = v.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
