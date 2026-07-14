import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getCronograma, listUsuarios } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UrgencyBadge, formatDate, tipoMarcoLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/cronograma")({
  component: CronogramaPage,
});

function CronogramaPage() {
  const fn = useServerFn(getCronograma);
  const usu = useServerFn(listUsuarios);
  const q = useQuery({ queryKey: ["cronograma"], queryFn: () => fn() });
  const qU = useQuery({ queryKey: ["usuarios"], queryFn: () => usu() });
  const [consultor, setConsultor] = useState<string>("all");
  const [urgencia, setUrgencia] = useState<string>("all");

  const filtered = useMemo(() => {
    return (q.data ?? []).filter((m: Record<string, unknown>) => {
      if (consultor !== "all" && m.consultor_responsavel_id !== consultor) return false;
      if (urgencia === "abertos" && m.data_entrega_real) return false;
      if (urgencia !== "all" && urgencia !== "abertos" && m.urgencia !== urgencia) return false;
      return true;
    });
  }, [q.data, consultor, urgencia]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cronograma consolidado</h1>
        <p className="text-sm text-muted-foreground">
          Todos os marcos ordenados por data prevista.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="w-64">
          <Select value={consultor} onValueChange={setConsultor}>
            <SelectTrigger>
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {(qU.data ?? []).map((u: Record<string, unknown>) => (
                <SelectItem key={u.id as string} value={u.id as string}>
                  {u.nome as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <Select value={urgencia} onValueChange={setUrgencia}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as urgências</SelectItem>
              <SelectItem value="abertos">Apenas abertos</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="critico_7">≤ 7 dias</SelectItem>
              <SelectItem value="alerta_15">≤ 15 dias</SelectItem>
              <SelectItem value="aviso_30">≤ 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filtered.length} marcos</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p>Carregando…</p>
          ) : (
            <div className="divide-y">
              {filtered.map((m: Record<string, unknown>) => (
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
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum marco no filtro atual.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
