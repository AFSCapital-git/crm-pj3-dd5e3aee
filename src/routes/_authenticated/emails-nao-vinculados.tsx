import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Link2, Trash2 } from "lucide-react";
import {
  listEmailsPendentes,
  vincularEmailManual,
  descartarEmailPendente,
} from "@/lib/emails.functions";
import { listProjetos } from "@/lib/projetos.functions";

export const Route = createFileRoute("/_authenticated/emails-nao-vinculados")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailsPendentes);
  const projetosFn = useServerFn(listProjetos);
  const vincularFn = useServerFn(vincularEmailManual);
  const descartarFn = useServerFn(descartarEmailPendente);

  const q = useQuery({ queryKey: ["emails-pendentes"], queryFn: () => listFn() });
  const projetos = useQuery({ queryKey: ["projetos"], queryFn: () => projetosFn() });

  const [sel, setSel] = useState<Record<string, string>>({});

  const mVincular = useMutation({
    mutationFn: (v: { pendente_id: string; projeto_id: string }) => vincularFn({ data: v }),
    onSuccess: () => {
      toast.success("E-mail vinculado ao projeto");
      qc.invalidateQueries({ queryKey: ["emails-pendentes"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao vincular"),
  });
  const mDescartar = useMutation({
    mutationFn: (id: string) => descartarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido da fila");
      qc.invalidateQueries({ queryKey: ["emails-pendentes"] });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">E-mails não vinculados</h1>
        <p className="text-sm text-muted-foreground">
          E-mails encaminhados sem código de rastreio válido no assunto. Vincule ao projeto correto
          ou descarte.
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Fila vazia.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {q.data?.map((p: any) => (
          <Card key={p.id as string}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {p.assunto || "(sem assunto)"}
                <Badge variant="outline" className="ml-auto text-xs">
                  {p.motivo}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                De <span className="text-foreground font-medium">{p.remetente_original}</span> ·{" "}
                {p.data_email_original
                  ? new Date(p.data_email_original).toLocaleString("pt-BR")
                  : new Date(p.criado_em).toLocaleString("pt-BR")}
              </div>
              {p.corpo_texto && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-4">
                  {p.corpo_texto}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Select
                  value={sel[p.id] ?? ""}
                  onValueChange={(v) => setSel({ ...sel, [p.id]: v })}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Selecionar projeto…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projetos.data?.map((pr: any) => (
                      <SelectItem key={pr.id as string} value={pr.id as string}>
                        [{pr.codigo_rastreio as string}] {pr.nome_projeto as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!sel[p.id] || mVincular.isPending}
                  onClick={() => mVincular.mutate({ pendente_id: p.id, projeto_id: sel[p.id] })}
                >
                  <Link2 className="h-4 w-4 mr-1" /> Vincular
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm("Descartar este e-mail?") && mDescartar.mutate(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
