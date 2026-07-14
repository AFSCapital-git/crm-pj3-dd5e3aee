import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listEmpresas, upsertEmpresa, deleteEmpresa } from "@/lib/empresas.functions";
import { listUsuarios } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/empresas")({
  component: EmpresasPage,
});

function EmpresasPage() {
  const list = useServerFn(listEmpresas);
  const usuarios = useServerFn(listUsuarios);
  const q = useQuery({ queryKey: ["empresas"], queryFn: () => list() });
  const qUsers = useQuery({ queryKey: ["usuarios"], queryFn: () => usuarios() });
  const qc = useQueryClient();

  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const upsert = useServerFn(upsertEmpresa);
  const del = useServerFn(deleteEmpresa);

  const mUpsert = useMutation({
    mutationFn: (input: any) => upsert({ data: input }),
    onSuccess: () => { toast.success("Empresa salva"); qc.invalidateQueries({ queryKey: ["empresas"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Empresa removida"); qc.invalidateQueries({ queryKey: ["empresas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas clientes</h1>
          <p className="text-sm text-muted-foreground">Carteira de empresas atendidas pela consultoria.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" /> Nova empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle></DialogHeader>
            <EmpresaForm
              initial={editing}
              usuarios={qUsers.data ?? []}
              onSubmit={(values: any) => mUpsert.mutate({ id: editing?.id, values })}
              loading={mUpsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Porte</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.razao_social}</TableCell>
                    <TableCell>{e.cnpj}</TableCell>
                    <TableCell>{e.porte}</TableCell>
                    <TableCell>{e.consultor?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Remover empresa?") && mDelete.mutate(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {q.data?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma empresa cadastrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmpresaForm({ initial, usuarios, onSubmit, loading }: any) {
  const [values, setValues] = useState({
    razao_social: initial?.razao_social ?? "",
    cnpj: initial?.cnpj ?? "",
    porte: initial?.porte ?? "ME",
    setor_atuacao: initial?.setor_atuacao ?? "",
    contato_responsavel: initial?.contato_responsavel ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ?? "",
    consultor_responsavel_id: initial?.consultor_responsavel_id ?? null,
    status: initial?.status ?? "lead",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(values); }} className="space-y-3">
      <div><Label>Razão social</Label><Input value={values.razao_social} onChange={(e) => setValues({ ...values, razao_social: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>CNPJ</Label><Input value={values.cnpj} onChange={(e) => setValues({ ...values, cnpj: e.target.value })} required /></div>
        <div>
          <Label>Porte</Label>
          <Select value={values.porte} onValueChange={(v) => setValues({ ...values, porte: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ME">ME</SelectItem>
              <SelectItem value="EPP">EPP</SelectItem>
              <SelectItem value="Grande">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Setor de atuação</Label><Input value={values.setor_atuacao ?? ""} onChange={(e) => setValues({ ...values, setor_atuacao: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Contato</Label><Input value={values.contato_responsavel ?? ""} onChange={(e) => setValues({ ...values, contato_responsavel: e.target.value })} /></div>
        <div><Label>Telefone</Label><Input value={values.telefone ?? ""} onChange={(e) => setValues({ ...values, telefone: e.target.value })} /></div>
      </div>
      <div><Label>E-mail</Label><Input type="email" value={values.email ?? ""} onChange={(e) => setValues({ ...values, email: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Consultor responsável</Label>
          <Select value={values.consultor_responsavel_id ?? "none"} onValueChange={(v) => setValues({ ...values, consultor_responsavel_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— sem responsável —</SelectItem>
              {usuarios.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button type="submit" disabled={loading}>Salvar</Button></DialogFooter>
    </form>
  );
}
