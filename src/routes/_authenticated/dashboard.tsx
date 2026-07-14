import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getDashboard } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UrgencyBadge,
  formatBRL,
  formatDate,
  statusProjetoLabel,
  tipoMarcoLabel,
} from "@/lib/labels";
import { AlertTriangle, TrendingUp, FolderKanban, Percent } from "lucide-react";
import { AiInsightsPanel } from "@/components/ai-insights-panel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  if (q.isLoading) return <div className="text-muted-foreground">Carregando…</div>;
  if (q.error) return <div className="text-destructive">{(q.error as Error).message}</div>;
  const d = q.data!;

  const kpis = [
    { label: "Valor captado", value: formatBRL(d.valorCaptado), icon: TrendingUp },
    { label: "Projetos", value: d.totalProjetos, icon: FolderKanban },
    { label: "Taxa de aprovação", value: `${(d.taxaAprovacao * 100).toFixed(0)}%`, icon: Percent },
    {
      label: "Marcos com alerta",
      value: d.counters.vencido + d.counters.critico_7 + d.counters.alerta_15 + d.counters.aviso_30,
      icon: AlertTriangle,
    },
  ];

  const counterCards = [
    {
      key: "vencido",
      label: "Vencidos",
      value: d.counters.vencido,
      cls: "bg-urgency-overdue text-urgency-overdue-fg",
    },
    {
      key: "critico_7",
      label: "≤ 7 dias",
      value: d.counters.critico_7,
      cls: "bg-urgency-critical text-urgency-critical-fg",
    },
    {
      key: "alerta_15",
      label: "≤ 15 dias",
      value: d.counters.alerta_15,
      cls: "bg-urgency-warning text-urgency-warning-fg",
    },
    {
      key: "aviso_30",
      label: "≤ 30 dias",
      value: d.counters.aviso_30,
      cls: "bg-urgency-notice text-urgency-notice-fg",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada da carteira e compliance de prazos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-semibold mt-1">{k.value}</p>
                </div>
                <k.icon className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counterCards.map((c) => (
          <div key={c.key} className={`rounded-lg p-4 ${c.cls}`}>
            <p className="text-xs uppercase tracking-wide opacity-80">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marcos vencendo (próximos 30 dias e vencidos)</CardTitle>
        </CardHeader>
        <CardContent>
          {d.marcos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum marco requer atenção imediata.</p>
          ) : (
            <div className="divide-y">
              {d.marcos.map((m: Record<string, unknown>) => (
                <Link
                  key={m.id as string}
                  to="/projetos/$id"
                  params={{ id: m.projeto_id as string }}
                  className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {tipoMarcoLabel(m.tipo)} — {m.nome_projeto}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.empresa_razao_social}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(m.data_prevista)}
                    </span>
                    <UrgencyBadge urgencia={m.urgencia} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projetos por status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(d.statusCount).map(([status, count]) => (
              <div key={status} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{statusProjetoLabel(status)}</p>
                <p className="text-xl font-semibold">{count as number}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AiInsightsPanel />
    </div>
  );
}
