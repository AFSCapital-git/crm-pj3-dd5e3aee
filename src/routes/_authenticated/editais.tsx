import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileSearch, AlertTriangle } from "lucide-react";
import { listEditais, upsertEdital, deleteEdital, setEditalAtivo } from "@/lib/editais.functions";
import { categoriaEditalLabel, formatBRL, formatDate } from "@/lib/labels";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/editais")({
  component: EditaisPage,
});

type EditalRow = {
  id: string;
  nome: string;
  categoria: string;
  orgao: string | null;
  valor_maximo_edital: number | null;
  prazo_submissao: string | null;
  ativo: boolean;
  requisitos_elegibilidade: string | null;
};

function diasParaPrazo(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const p = new Date(prazo);
  p.setHours(0, 0, 0, 0);
  return Math.round((p.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function PrazoBadge({ prazo }: { prazo: string | null }) {
  const dias = diasParaPrazo(prazo);
  if (dias === null) return null;
  if (dias < 0)
    return <Badge className="bg-urgency-overdue text-urgency-overdue-fg border-transparent">Encerrado</Badge>;
  if (dias <= 7)
    return (
      <Badge className="bg-urgency-critical text-urgency-critical-fg border-transparent gap-1">
        <AlertTriangle className="h-3 w-3" /> {dias === 0 ? "Vence hoje" : `${dias}d`}
      </Badge>
    );
  if (dias <= 15)
    return <Badge className="bg-urgency-warning text-urgency-warning-fg border-transparent">≤ 15 dias</Badge>;
  if (dias <= 30)
    return <Badge className="bg-urgency-notice text-urgency-notice-fg border-transparent">≤ 30 dias</Badge>;
  return <Badge className="bg-urgency-ok text-urgency-ok-fg border-transparent">Aberto</Badge>;
}

function EditaisPage() {
  const list = useServerFn(listEditais);
  const upsert = useServerFn(upsertEdital);
  const del = useServerFn(deleteEdital);
  const setAtivo = useServerFn(setEditalAtivo);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["editais"], queryFn: () => list() });
  const [editing, setEditing] = useState<EditalRow | null>(null);
  const [open, setOpen] = useState(false);

  const mUpsert = useMutation({
    mutationFn: (input: { id?: string; values: any }) => upsert({ data: input }),
    onSuccess: () => {
      toast.success("Edital salvo");
      qc.invalidateQueries({ queryKey: ["editais"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["editais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mToggle = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => setAtivo({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.ativo ? "Edital ativado" : "Edital inativado");
      qc.invalidateQueries({ queryKey: ["editais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as EditalRow[];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Editais FINEP</h1>
          <p className="text-sm text-muted-foreground">Catálogo de linhas de financiamento.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" />Novo edital</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar edital" : "Novo edital"}</DialogTitle></DialogHeader>
            <EditalForm initial={editing} onSubmit={(v: any) => mUpsert.mutate({ id: editing?.id, values: v })} loading={mUpsert.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {q.isLoading ? (
        <Card><CardContent className="pt-6"><p>Carregando…</p></CardContent></Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <FileSearch className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Nenhum item cadastrado ainda</p>
              <p className="text-sm text-muted-foreground">Cadastre o primeiro edital do catálogo para começar.</p>
            </div>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Cadastrar primeiro edital
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="pt-6">
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
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.nome}</TableCell>
                      <TableCell>{categoriaEditalLabel(e.categoria)}</TableCell>
                      <TableCell>{e.orgao ?? "—"}</TableCell>
                      <TableCell>{formatBRL(e.valor_maximo_edital)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatDate(e.prazo_submissao)}</span>
                          <PrazoBadge prazo={e.prazo_submissao} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={e.ativo}
                            disabled={mToggle.isPending}
                            onCheckedChange={(v) => mToggle.mutate({ id: e.id, ativo: v })}
                            aria-label={e.ativo ? "Inativar edital" : "Ativar edital"}
                          />
                          <span className="text-xs text-muted-foreground">{e.ativo ? "Ativo" : "Inativo"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <RemoveButton onConfirm={() => mDelete.mutate(e.id)} nome={e.nome} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile: cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map((e) => (
              <Card key={e.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoriaEditalLabel(e.categoria)} · {e.orgao ?? "—"}
                      </p>
                    </div>
                    <PrazoBadge prazo={e.prazo_submissao} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor máx.</p>
                      <p>{formatBRL(e.valor_maximo_edital)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo</p>
                      <p>{formatDate(e.prazo_submissao)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={e.ativo}
                        disabled={mToggle.isPending}
                        onCheckedChange={(v) => mToggle.mutate({ id: e.id, ativo: v })}
                      />
                      <span className="text-xs text-muted-foreground">{e.ativo ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <RemoveButton onConfirm={() => mDelete.mutate(e.id)} nome={e.nome} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RemoveButton({ onConfirm, nome }: { onConfirm: () => void; nome: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover edital?</AlertDialogTitle>
          <AlertDialogDescription>
            "{nome}" será removido do catálogo. Projetos existentes que já referenciam este edital são mantidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
