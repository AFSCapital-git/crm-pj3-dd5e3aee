import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, XCircle, Trash2, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  gerarInsightsPortfolio,
  gerarRascunhoRelatorio,
  listInsights,
  revisarInsight,
  deleteInsight,
} from "@/lib/ai-insights.functions";

const TIPO_LABEL: Record<string, string> = {
  alerta_risco: "Alerta de risco",
  sugestao: "Sugestão",
  rascunho_relatorio: "Rascunho de relatório",
};

export function AiInsightsPanel({
  projetoId,
  isAdmin = false,
}: {
  projetoId?: string;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listInsights);
  const genPortfolioFn = useServerFn(gerarInsightsPortfolio);
  const genReportFn = useServerFn(gerarRascunhoRelatorio);
  const reviewFn = useServerFn(revisarInsight);
  const delFn = useServerFn(deleteInsight);

  const scope = projetoId ?? "portfolio";
  const q = useQuery({
    queryKey: ["insights_ia", scope],
    queryFn: () => listFn({ data: projetoId ? { projeto_id: projetoId } : { projeto_id: null } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["insights_ia", scope] });

  const mGenPortfolio = useMutation({
    mutationFn: () => genPortfolioFn(),
    onSuccess: () => {
      toast.success("Análise gerada pela IA");
      invalidate();
    },
    onError: (e: unknown) => {
      const error = e as Record<string, unknown>;
      toast.error(String(error?.message ?? "Erro ao gerar análise"));
    },
  });
  const mGenReport = useMutation({
    mutationFn: () => genReportFn({ data: { projeto_id: projetoId! } }),
    onSuccess: () => {
      toast.success("Rascunho gerado pela IA");
      invalidate();
    },
    onError: (e: unknown) => {
      const error = e as Record<string, unknown>;
      toast.error(String(error?.message ?? "Erro ao gerar rascunho"));
    },
  });
  const mReview = useMutation({
    mutationFn: (v: { id: string; aprovado: boolean }) => reviewFn({ data: v }),
    onSuccess: () => {
      toast.success("Revisão registrada");
      invalidate();
    },
    onError: (e: unknown) => {
      const error = e as Record<string, unknown>;
      toast.error(String(error?.message ?? "Erro ao revisar"));
    },
  });
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Insight removido");
      invalidate();
    },
    onError: (e: unknown) => {
      const error = e as Record<string, unknown>;
      toast.error(String(error?.message ?? "Erro ao remover"));
    },
  });

  const items = q.data ?? [];

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Assistente de Portfólio (IA)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Todo conteúdo abaixo é <strong>gerado por IA</strong> e precisa de revisão humana antes
            de virar ação.
          </p>
        </div>
        <div className="flex gap-2">
          {projetoId ? (
            <Button size="sm" onClick={() => mGenReport.mutate()} disabled={mGenReport.isPending}>
              {mGenReport.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Gerar rascunho de relatório
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => mGenPortfolio.mutate()}
              disabled={mGenPortfolio.isPending}
            >
              {mGenPortfolio.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analisar portfólio
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum insight gerado ainda. Clique no botão acima para pedir uma análise.
          </p>
        ) : (
          <div className="space-y-4">
            {(items as any[]).map((it: any) => (
              <div key={it.id as string} className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/15">
                        <Bot className="h-3 w-3 mr-1" /> IA
                      </Badge>
                      <Badge variant="outline">
                        {TIPO_LABEL[it.tipo as keyof typeof TIPO_LABEL] ?? (it.tipo as string)}
                      </Badge>
                      {(it.revisado_por_humano as boolean) ? (
                        (it.aprovado as boolean) ? (
                          <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border border-green-600/30 hover:bg-green-600/15">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovado por humano
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600/15 text-red-700 dark:text-red-400 border border-red-600/30 hover:bg-red-600/15">
                            <XCircle className="h-3 w-3 mr-1" /> Rejeitado
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary">Aguardando revisão humana</Badge>
                      )}
                    </div>
                    {it.titulo && <p className="font-medium mt-2">{it.titulo}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Gerado em {new Date(it.gerado_em).toLocaleString("pt-BR")}
                      {it.modelo && (
                        <>
                          {" "}
                          · modelo <code className="text-[10px]">{it.modelo}</code>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!it.revisado_por_humano && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mReview.mutate({ id: it.id, aprovado: true })}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mReview.mutate({ id: it.id, aprovado: false })}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                        </Button>
                      </>
                    )}
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => confirm("Excluir insight?") && mDel.mutate(it.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {it.conteudo_gerado}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
