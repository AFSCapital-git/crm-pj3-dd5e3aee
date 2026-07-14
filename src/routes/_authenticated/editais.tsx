import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { upsertEdital, deleteEdital } from "@/lib/editais.functions";
import { categoriaEditalLabel, formatBRL, formatDate } from "@/lib/labels";
import { listEditaisPaginado } from "@/lib/pagination.functions";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";

export const Route = createFileRoute("/_authenticated/editais")({
  component: EditaisPage,
});

function EditaisPage() {
  const listFn = useServerFn(listEditaisPaginado);
  const upsert = useServerFn(upsertEdital);
  const del = useServerFn(deleteEdital);
  const qc = useQueryClient();
  const { items, loadMore, hasMore, isLoadingMore, isLoading, error } = usePaginatedQuery(
    ["editais-paginated"],
    (cursor) => listFn({ data: { cursor, pageSize: 50 } }),
  );
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);

  const mUpsert = useMutation({
    mutationFn: (input: Record<string, unknown>) => upsert({ data: input }),
    onSuccess: () => {
      toast.success("Edital salvo");
      qc.invalidateQueries({ queryKey: ["editais-paginated"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["editais-paginated"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editais FINEP</h1>
          <p className="text-sm text-muted-foreground">Catálogo de linhas de financiamento.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo edital
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar edital" : "Novo edital"}</DialogTitle>
            </DialogHeader>
            <EditalForm
              initial={editing}
              onSubmit={(v: Record<string, unknown>) =>
                mUpsert.mutate({ id: editing?.id, values: v })
              }
              loading={mUpsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Catálogo{" "}
            {items.length > 0 && <span className="text-sm font-normal">({items.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>Carregando…</p>
          ) : error ? (
            <p className="text-destructive">{error.message}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Valor máximo</TableHead>
                    <TableHead>Prazo submissão</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e: Record<string, unknown>) => {
                    const aberto = e.prazo_submissao && e.prazo_submissao >= today;
                    return (
                      <TableRow key={e.id as string}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell>{categoriaEditalLabel(e.categoria)}</TableCell>
                        <TableCell>{e.orgao ?? "—"}</TableCell>
                        <TableCell>{formatBRL(e.valor_maximo_edital)}</TableCell>
                        <TableCell>
                          {formatDate(e.prazo_submissao)}
                          {aberto && (
                            <Badge className="ml-2 bg-urgency-ok text-urgency-ok-fg border-transparent">
                              Aberto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{e.ativo ? "Sim" : "Não"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(e);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => confirm("Remover?") && mDelete.mutate(e.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum edital cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => loadMore()}
                    disabled={isLoadingMore}
                    variant="outline"
                    className="w-full"
                  >
                    {isLoadingMore ? "Carregando…" : "Carregar mais"}
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

function EditalForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: Record<string, unknown> | null;
  onSubmit: (values: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [v, setV] = useState({
    nome: (initial?.nome as string) ?? "",
    categoria: (initial?.categoria as string) ?? "subvencao_economica",
    orgao: (initial?.orgao as string) ?? "FINEP",
    valor_maximo_edital: initial?.valor_maximo_edital ?? null,
    prazo_submissao: (initial?.prazo_submissao as string) ?? "",
    requisitos_elegibilidade: (initial?.requisitos_elegibilidade as string) ?? "",
    ativo: (initial?.ativo as boolean) ?? true,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...v,
          valor_maximo_edital: v.valor_maximo_edital ? Number(v.valor_maximo_edital) : null,
          prazo_submissao: v.prazo_submissao || null,
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label>Nome</Label>
        <Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoria</Label>
          <Select value={v.categoria} onValueChange={(x: string) => setV({ ...v, categoria: x })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subvencao_economica">Subvenção Econômica</SelectItem>
              <SelectItem value="reembolsavel">Reembolsável</SelectItem>
              <SelectItem value="RHAE">RHAE</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Órgão</Label>
          <Input value={v.orgao ?? ""} onChange={(e) => setV({ ...v, orgao: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor máximo (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={v.valor_maximo_edital ?? ""}
            onChange={(e) => setV({ ...v, valor_maximo_edital: e.target.value })}
          />
        </div>
        <div>
          <Label>Prazo submissão</Label>
          <Input
            type="date"
            value={v.prazo_submissao ?? ""}
            onChange={(e) => setV({ ...v, prazo_submissao: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Requisitos de elegibilidade</Label>
        <Textarea
          value={v.requisitos_elegibilidade ?? ""}
          onChange={(e) => setV({ ...v, requisitos_elegibilidade: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={v.ativo} onCheckedChange={(x) => setV({ ...v, ativo: x })} />
        <Label>Ativo</Label>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
