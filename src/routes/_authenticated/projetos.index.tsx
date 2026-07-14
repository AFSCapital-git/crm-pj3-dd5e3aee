import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Download } from "lucide-react";
import { listProjetos, upsertProjeto } from "@/lib/projetos.functions";
import { listEmpresas } from "@/lib/empresas.functions";
import { listEditais } from "@/lib/editais.functions";
import { exportProjetosCsv } from "@/lib/dashboard.functions";
import { formatBRL, statusProjetoLabel } from "@/lib/labels";

const STATUS = ["em_elaboracao","submetido","em_analise","aprovado","contratado","em_execucao","em_prestacao_contas","encerrado","reprovado"] as const;

export const Route = createFileRoute("/_authenticated/projetos/")({
  component: ProjetosPage,
});

function ProjetosPage() {
  const list = useServerFn(listProjetos);
  const empresas = useServerFn(listEmpresas);
  const editais = useServerFn(listEditais);
  const upsert = useServerFn(upsertProjeto);
  const exp = useServerFn(exportProjetosCsv);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["projetos"], queryFn: () => list() });
  const qEmp = useQuery({ queryKey: ["empresas"], queryFn: () => empresas() });
  const qEd = useQuery({ queryKey: ["editais"], queryFn: () => editais() });

  const [open, setOpen] = useState(false);
  const mUpsert = useMutation({
    mutationFn: (input: any) => upsert({ data: input }),
    onSuccess: () => { toast.success("Projeto salvo"); qc.invalidateQueries({ queryKey: ["projetos"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleExport() {
    const r = await exp();
    const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">Carteira de projetos FINEP em curso.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo projeto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
              <ProjetoForm empresas={qEmp.data ?? []} editais={qEd.data ?? []} onSubmit={(v: any) => mUpsert.mutate({ values: v })} loading={mUpsert.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {q.isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Edital</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Solicitado</TableHead>
                <TableHead>Aprovado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(q.data ?? []).map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => location.assign(`/projetos/${p.id}`)}>
                    <TableCell className="font-medium">
                      <Link to="/projetos/$id" params={{ id: p.id }} className="hover:underline">
                        {p.nome_projeto}
                      </Link>
                    </TableCell>
                    <TableCell>{p.empresa?.razao_social ?? "—"}</TableCell>
                    <TableCell>{p.edital?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{statusProjetoLabel(p.status)}</Badge></TableCell>
                    <TableCell>{formatBRL(p.valor_solicitado)}</TableCell>
                    <TableCell>{formatBRL(p.valor_aprovado)}</TableCell>
                  </TableRow>
                ))}
                {q.data?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum projeto ainda.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjetoForm({ empresas, editais, onSubmit, loading, initial }: any) {
  const [v, setV] = useState({
    empresa_cliente_id: initial?.empresa_cliente_id ?? empresas[0]?.id ?? "",
    linha_edital_id: initial?.linha_edital_id ?? null,
    nome_projeto: initial?.nome_projeto ?? "",
    valor_solicitado: initial?.valor_solicitado ?? "",
    valor_aprovado: initial?.valor_aprovado ?? "",
    status: initial?.status ?? "em_elaboracao",
    data_submissao: initial?.data_submissao ?? "",
    prazo_execucao_meses: initial?.prazo_execucao_meses ?? "",
    area_tecnologica: initial?.area_tecnologica ?? "",
  });
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSubmit({
        ...v,
        valor_solicitado: v.valor_solicitado === "" ? null : Number(v.valor_solicitado),
        valor_aprovado: v.valor_aprovado === "" ? null : Number(v.valor_aprovado),
        prazo_execucao_meses: v.prazo_execucao_meses === "" ? null : Number(v.prazo_execucao_meses),
        data_submissao: v.data_submissao || null,
        linha_edital_id: v.linha_edital_id || null,
        area_tecnologica: v.area_tecnologica || null,
      });
    }} className="space-y-3">
      <div><Label>Nome do projeto</Label><Input value={v.nome_projeto} onChange={(e) => setV({ ...v, nome_projeto: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Empresa</Label>
          <Select value={v.empresa_cliente_id} onValueChange={(x) => setV({ ...v, empresa_cliente_id: x })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Edital</Label>
          <Select value={v.linha_edital_id ?? "none"} onValueChange={(x) => setV({ ...v, linha_edital_id: x === "none" ? null : x })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— sem edital —</SelectItem>
              {editais.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Valor solicitado</Label><Input type="number" step="0.01" value={v.valor_solicitado ?? ""} onChange={(e) => setV({ ...v, valor_solicitado: e.target.value as any })} /></div>
        <div><Label>Valor aprovado</Label><Input type="number" step="0.01" value={v.valor_aprovado ?? ""} onChange={(e) => setV({ ...v, valor_aprovado: e.target.value as any })} /></div>
        <div><Label>Prazo (meses)</Label><Input type="number" value={v.prazo_execucao_meses ?? ""} onChange={(e) => setV({ ...v, prazo_execucao_meses: e.target.value as any })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={v.status} onValueChange={(x) => setV({ ...v, status: x as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{statusProjetoLabel(s)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Data de submissão</Label><Input type="date" value={v.data_submissao ?? ""} onChange={(e) => setV({ ...v, data_submissao: e.target.value })} /></div>
      </div>
      <div><Label>Área tecnológica</Label><Input value={v.area_tecnologica ?? ""} onChange={(e) => setV({ ...v, area_tecnologica: e.target.value })} /></div>
      <DialogFooter><Button type="submit" disabled={loading}>Salvar</Button></DialogFooter>
    </form>
  );
}
