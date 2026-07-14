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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listEditais, upsertEdital, deleteEdital } from "@/lib/editais.functions";
import { categoriaEditalLabel, formatBRL, formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/editais")({
  component: EditaisPage,
});

function EditaisPage() {
  const list = useServerFn(listEditais);
  const upsert = useServerFn(upsertEdital);
  const del = useServerFn(deleteEdital);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["editais"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const mUpsert = useMutation({
    mutationFn: (input: any) => upsert({ data: input }),
    onSuccess: () => { toast.success("Edital salvo"); qc.invalidateQueries({ queryKey: ["editais"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["editais"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editais FINEP</h1>
          <p className="text-sm text-muted-foreground">Catálogo de linhas de financiamento.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo edital</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar edital" : "Novo edital"}</DialogTitle></DialogHeader>
            <EditalForm initial={editing} onSubmit={(v) => mUpsert.mutate({ id: editing?.id, values: v })} loading={mUpsert.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {q.isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Valor máximo</TableHead>
                <TableHead>Prazo submissão</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {(q.data ?? []).map((e: any) => {
                  const aberto = e.prazo_submissao && e.prazo_submissao >= today;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.nome}</TableCell>
                      <TableCell>{categoriaEditalLabel(e.categoria)}</TableCell>
                      <TableCell>{e.orgao ?? "—"}</TableCell>
                      <TableCell>{formatBRL(e.valor_maximo_edital)}</TableCell>
                      <TableCell>
                        {formatDate(e.prazo_submissao)}
                        {aberto && <Badge className="ml-2 bg-urgency-ok text-urgency-ok-fg border-transparent">Aberto</Badge>}
                      </TableCell>
                      <TableCell>{e.ativo ? "Sim" : "Não"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm("Remover?") && mDelete.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {q.data?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum edital cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditalForm({ initial, onSubmit, loading }: any) {
  const [v, setV] = useState({
    nome: initial?.nome ?? "",
    categoria: initial?.categoria ?? "subvencao_economica",
    orgao: initial?.orgao ?? "FINEP",
    valor_maximo_edital: initial?.valor_maximo_edital ?? null,
    prazo_submissao: initial?.prazo_submissao ?? "",
    requisitos_elegibilidade: initial?.requisitos_elegibilidade ?? "",
    ativo: initial?.ativo ?? true,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, valor_maximo_edital: v.valor_maximo_edital ? Number(v.valor_maximo_edital) : null, prazo_submissao: v.prazo_submissao || null }); }} className="space-y-3">
      <div><Label>Nome</Label><Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoria</Label>
          <Select value={v.categoria} onValueChange={(x) => setV({ ...v, categoria: x as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="subvencao_economica">Subvenção Econômica</SelectItem>
              <SelectItem value="reembolsavel">Reembolsável</SelectItem>
              <SelectItem value="RHAE">RHAE</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Órgão</Label><Input value={v.orgao ?? ""} onChange={(e) => setV({ ...v, orgao: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Valor máximo (R$)</Label><Input type="number" step="0.01" value={v.valor_maximo_edital ?? ""} onChange={(e) => setV({ ...v, valor_maximo_edital: e.target.value as any })} /></div>
        <div><Label>Prazo submissão</Label><Input type="date" value={v.prazo_submissao ?? ""} onChange={(e) => setV({ ...v, prazo_submissao: e.target.value })} /></div>
      </div>
      <div><Label>Requisitos de elegibilidade</Label><Textarea value={v.requisitos_elegibilidade ?? ""} onChange={(e) => setV({ ...v, requisitos_elegibilidade: e.target.value })} /></div>
      <div className="flex items-center gap-2"><Switch checked={v.ativo} onCheckedChange={(x) => setV({ ...v, ativo: x })} /><Label>Ativo</Label></div>
      <DialogFooter><Button type="submit" disabled={loading}>Salvar</Button></DialogFooter>
    </form>
  );
}
