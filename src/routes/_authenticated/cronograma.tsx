import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listUsuarios } from "@/lib/dashboard.functions";
import { listMarcosPaginado } from "@/lib/pagination.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UrgencyBadge, formatDate, tipoMarcoLabel } from "@/lib/labels";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cronograma")({
  component: CronogramaPage,
});

function CronogramaPage() {
  const marcosFn = useServerFn(listMarcosPaginado);
  const usu = useServerFn(listUsuarios);
  const {
    items: marcos,
    loadMore,
    hasMore,
    isLoadingMore,
    isLoading,
  } = usePaginatedQuery(["cronograma-paginated"], (cursor) =>
    marcosFn({ data: { cursor, pageSize: 50 } }),
  );
  const qU = useQuery({ queryKey: ["usuarios"], queryFn: () => usu() });
  const [consultor, setConsultor] = useState<string>("all");
  const [urgencia, setUrgencia] = useState<string>("all");

  const filtered = useMemo(() => {
    return marcos.filter((m: Record<string, unknown>) => {
      if (consultor !== "all" && m.consultor_responsavel_id !== consultor) return false;
      if (urgencia === "abertos" && m.data_entrega_real) return false;
      if (urgencia !== "all" && urgencia !== "abertos" && m.urgencia !== urgencia) return false;
      return true;
    });
  }, [marcos, consultor, urgencia]);

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
          <CardTitle>
            {filtered.length} marcos{" "}
            {marcos.length > 0 && (
              <span className="text-sm font-normal">(carregados: {marcos.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>Carregando…</p>
          ) : (
            <>
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
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => loadMore()}
                    disabled={isLoadingMore}
                    variant="outline"
                    className="w-full"
                  >
                    {isLoadingMore ? "Carregando…" : "Carregar mais marcos"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
