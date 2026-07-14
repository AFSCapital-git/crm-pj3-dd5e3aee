import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Plus, Trash2, Mail } from "lucide-react";
import { getProjeto } from "@/lib/projetos.functions";
import { upsertMarco, marcarEntregue, deleteMarco, createInteracao } from "@/lib/marcos.functions";
import { UrgencyBadge, formatBRL, formatDate, statusProjetoLabel, tipoMarcoLabel, tipoInteracaoLabel } from "@/lib/labels";
import { DocumentosTab } from "@/components/documentos-tab";
import { EmailsTab } from "@/components/emails-tab";
import { AiInsightsPanel } from "@/components/ai-insights-panel";

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  component: ProjetoDetail,
});

function ProjetoDetail() {
  const { id } = useParams({ from: "/_authenticated/projetos/$id" });
  const fn = useServerFn(getProjeto);
  const q = useQuery({ queryKey: ["projeto", id], queryFn: () => fn({ data: { id } }) });
  const qc = useQueryClient();

  const upsert = useServerFn(upsertMarco);
  const marcar = useServerFn(marcarEntregue);
  const del = useServerFn(deleteMarco);
  const criarNota = useServerFn(createInteracao);

  const [openMarco, setOpenMarco] = useState(false);
  const [nota, setNota] = useState("");

  const mUpsertMarco = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Marco salvo"); qc.invalidateQueries({ queryKey: ["projeto", id] }); setOpenMarco(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const mMarcar = useMutation({
    mutationFn: (v: any) => marcar({ data: v }),
    onSuccess: () => { toast.success("Marco entregue"); qc.invalidateQueries({ queryKey: ["projeto", id] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelMarco = useMutation({
    mutationFn: (mid: string) => del({ data: { id: mid } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["projeto", id] }); },
  });
  const mNota = useMutation({
    mutationFn: () => criarNota({ data: { projeto_id: id, tipo: "nota", descricao: nota } }),
    onSuccess: () => { setNota(""); qc.invalidateQueries({ queryKey: ["projeto", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <p>Carregando…</p>;
  if (!q.data) return <p className="text-muted-foreground">Projeto não encontrado.</p>;
  const { projeto, marcos, interacoes } = q.data;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{projeto.nome_projeto}</h1>
          <Badge variant="outline">{statusProjetoLabel(projeto.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{projeto.empresa?.razao_social} · CNPJ {projeto.empresa?.cnpj}</p>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="marcos">Marcos ({marcos.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo ({interacoes.length})</TabsTrigger>
          <TabsTrigger value="ia">Assistente IA</TabsTrigger>
        </TabsList>


        <TabsContent value="dados">
          <Card><CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Edital" value={projeto.edital?.nome ?? "—"} />
            <Info label="Órgão" value={projeto.edital?.orgao ?? "—"} />
            <Info label="Área tecnológica" value={projeto.area_tecnologica ?? "—"} />
            <Info label="Data de submissão" value={formatDate(projeto.data_submissao)} />
            <Info label="Prazo de execução" value={projeto.prazo_execucao_meses ? `${projeto.prazo_execucao_meses} meses` : "—"} />
            <Info label="Valor solicitado" value={formatBRL(projeto.valor_solicitado)} />
            <Info label="Valor aprovado" value={formatBRL(projeto.valor_aprovado)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="marcos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Marcos e entregas</CardTitle>
              <Dialog open={openMarco} onOpenChange={setOpenMarco}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Novo marco</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo marco</DialogTitle></DialogHeader>
                  <MarcoForm projetoId={id} onSubmit={(v: any) => mUpsertMarco.mutate(v)} loading={mUpsertMarco.isPending} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {marcos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum marco cadastrado.</p> : (
                <div className="divide-y">
                  {marcos.map((m: any) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{tipoMarcoLabel(m.tipo)}</p>
                        <p className="text-xs text-muted-foreground">
                          Previsto: {formatDate(m.data_prevista)}
                          {m.data_entrega_real && <> · Entregue: {formatDate(m.data_entrega_real)}</>}
                        </p>
                        {m.descricao && <p className="text-sm mt-1">{m.descricao}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <UrgencyBadge urgencia={m.urgencia} />
                        {!m.data_entrega_real && (
                          <MarcarEntregueDialog
                            marco={m}
                            onConfirm={(dt) => mMarcar.mutate({ id: m.id, data_entrega_real: dt })}
                          />
                        )}
                        <Button size="icon" variant="ghost" onClick={() => confirm("Remover marco?") && mDelMarco.mutate(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentosTab projetoId={id} />
        </TabsContent>

        <TabsContent value="emails">
          <EmailsTab projetoId={id} codigoRastreio={projeto.codigo_rastreio} />
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle>Linha do tempo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea placeholder="Adicionar nota / registrar interação..." value={nota} onChange={(e) => setNota(e.target.value)} />
                <Button onClick={() => nota && mNota.mutate()} disabled={mNota.isPending || !nota}>Adicionar</Button>
              </div>
              <div className="space-y-3">
                {interacoes.map((i: any) => (
                  <div key={i.id} className="border-l-2 border-primary/40 pl-4 py-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={i.tipo === "email_encaminhado" ? "secondary" : "outline"} className="flex items-center gap-1">
                        {i.tipo === "email_encaminhado" && <Mail className="h-3 w-3" />}
                        {tipoInteracaoLabel(i.tipo)}
                      </Badge>
                      <span>{new Date(i.data_hora).toLocaleString("pt-BR")}</span>
                      {i.autor?.nome && <span>· {i.autor.nome}</span>}
                    </div>
                    <p className="text-sm mt-1">{i.descricao}</p>
                  </div>
                ))}
                {interacoes.length === 0 && <p className="text-sm text-muted-foreground">Sem interações ainda.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function MarcoForm({ projetoId, onSubmit, loading }: any) {
  const [v, setV] = useState({
    projeto_id: projetoId,
    tipo: "relatorio_tecnico",
    descricao: "",
    data_prevista: "",
    responsavel_id: null as string | null,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ values: { ...v, descricao: v.descricao || null } }); }} className="space-y-3">
      <div>
        <Label>Tipo</Label>
        <Select value={v.tipo} onValueChange={(x) => setV({ ...v, tipo: x as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relatorio_tecnico">Relatório técnico</SelectItem>
            <SelectItem value="relatorio_financeiro">Relatório financeiro</SelectItem>
            <SelectItem value="prestacao_contas_parcial">Prestação de contas parcial</SelectItem>
            <SelectItem value="prestacao_contas_final">Prestação de contas final</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Data prevista</Label><Input type="date" value={v.data_prevista} onChange={(e) => setV({ ...v, data_prevista: e.target.value })} required /></div>
      <div><Label>Descrição</Label><Textarea value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></div>
      <DialogFooter><Button type="submit" disabled={loading}>Salvar</Button></DialogFooter>
    </form>
  );
}

function MarcarEntregueDialog({ marco, onConfirm }: { marco: any; onConfirm: (dt: string) => void }) {
  const [dt, setDt] = useState(new Date().toISOString().slice(0, 10));
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline"><CheckCircle2 className="h-4 w-4 mr-1" />Marcar como entregue</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar entrega do marco</AlertDialogTitle>
          <AlertDialogDescription>
            {tipoMarcoLabel(marco.tipo)} · Previsto para {formatDate(marco.data_prevista)}.
            Confirme a data real de entrega — a comparação com a data prevista é registrada automaticamente na linha do tempo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label>Data real de entrega</Label>
          <Input type="date" value={dt} onChange={(e) => setDt(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(dt)}>Confirmar entrega</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
