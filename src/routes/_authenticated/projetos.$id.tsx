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
import { Badge } from "@/components/ui/badge";
<<<<<<< HEAD
import { CheckCircle2, Plus, Trash2, Mail } from "lucide-react";
import { getProjeto, listInteracoesPaginado } from "@/lib/projetos.functions";
=======
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Plus, Trash2, Mail, MessageSquare, StickyNote,
  Phone, Users, FileText, RefreshCw, FilePlus2, MessageSquarePlus, Loader2, Inbox,
} from "lucide-react";
import { getProjeto, getProjetoTimeline } from "@/lib/projetos.functions";
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
import { upsertMarco, marcarEntregue, deleteMarco, createInteracao } from "@/lib/marcos.functions";
import {
  UrgencyBadge,
  formatBRL,
  formatDate,
  statusProjetoLabel,
  tipoMarcoLabel,
  tipoInteracaoLabel,
} from "@/lib/labels";
import { DocumentosTab } from "@/components/documentos-tab";
import { EmailsTab } from "@/components/emails-tab";
import { AiInsightsPanel } from "@/components/ai-insights-panel";
import { cn } from "@/lib/utils";

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
<<<<<<< HEAD
  const criarNota = useServerFn(createInteracao);
  const listInteracoes = useServerFn(listInteracoesPaginado);

  const [openMarco, setOpenMarco] = useState(false);
  const [nota, setNota] = useState("");
  const [interacaoCursor, setInteracaoCursor] = useState<string | null>(null);

  const qInteracoes = useQuery({
    queryKey: ["projeto-interacoes", id, interacaoCursor],
    queryFn: () =>
      listInteracoes({ data: { projeto_id: id, cursor: interacaoCursor, pageSize: 20 } }),
    enabled: !!id,
  });
=======

  const [openMarco, setOpenMarco] = useState(false);
  const [openInteracao, setOpenInteracao] = useState(false);
  const [tab, setTab] = useState("dados");
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de

  const mUpsertMarco = useMutation({
    mutationFn: (v: Record<string, unknown>) => upsert({ data: v }),
    onSuccess: () => {
      toast.success("Marco salvo");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
      setOpenMarco(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mMarcar = useMutation({
    mutationFn: (v: Record<string, unknown>) => marcar({ data: v }),
    onSuccess: () => {
      toast.success("Marco entregue");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelMarco = useMutation({
    mutationFn: (mid: string) => del({ data: { id: mid } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
    },
  });
<<<<<<< HEAD
  const mNota = useMutation({
    mutationFn: () => criarNota({ data: { projeto_id: id, tipo: "nota", descricao: nota } }),
    onSuccess: () => {
      setNota("");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
=======
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de

  if (q.isLoading) return <p>Carregando…</p>;
  if (!q.data) return <p className="text-muted-foreground">Projeto não encontrado.</p>;
  const { projeto, marcos } = q.data;

  return (
    <div className="space-y-6 pb-24">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{projeto.nome_projeto}</h1>
          <Badge variant="outline">{statusProjetoLabel(projeto.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {projeto.empresa?.razao_social} · CNPJ {projeto.empresa?.cnpj}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="marcos">Marcos ({marcos.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="ia">Assistente IA</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
              <Info label="Edital" value={projeto.edital?.nome ?? "—"} />
              <Info label="Órgão" value={projeto.edital?.orgao ?? "—"} />
              <Info label="Área tecnológica" value={projeto.area_tecnologica ?? "—"} />
              <Info label="Data de submissão" value={formatDate(projeto.data_submissao)} />
              <Info
                label="Prazo de execução"
                value={projeto.prazo_execucao_meses ? `${projeto.prazo_execucao_meses} meses` : "—"}
              />
              <Info label="Valor solicitado" value={formatBRL(projeto.valor_solicitado)} />
              <Info label="Valor aprovado" value={formatBRL(projeto.valor_aprovado)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marcos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Marcos e entregas</CardTitle>
              <Dialog open={openMarco} onOpenChange={setOpenMarco}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo marco
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo marco</DialogTitle>
                  </DialogHeader>
                  <MarcoForm
                    projetoId={id}
                    onSubmit={(v: Record<string, unknown>) => mUpsertMarco.mutate(v)}
                    loading={mUpsertMarco.isPending}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {marcos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum marco cadastrado.</p>
              ) : (
                <div className="divide-y">
                  {marcos.map((m: Record<string, unknown>) => (
                    <div
                      key={m.id as string}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{tipoMarcoLabel(m.tipo)}</p>
                        <p className="text-xs text-muted-foreground">
                          Previsto: {formatDate(m.data_prevista)}
                          {m.data_entrega_real && (
                            <> · Entregue: {formatDate(m.data_entrega_real)}</>
                          )}
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
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => confirm("Remover marco?") && mDelMarco.mutate(m.id)}
                        >
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
<<<<<<< HEAD
          <Card>
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar nota / registrar interação..."
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
                <Button
                  onClick={() => nota && mNota.mutate()}
                  disabled={mNota.isPending || !nota}
                  className="shrink-0"
                >
                  Adicionar
                </Button>
              </div>
              <div className="space-y-3">
                {qInteracoes.data?.items?.map((i: Record<string, unknown>) => (
                  <div key={i.id as string} className="border-l-2 border-primary/40 pl-4 py-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={i.tipo === "email_encaminhado" ? "secondary" : "outline"}
                        className="flex items-center gap-1"
                      >
                        {i.tipo === "email_encaminhado" && <Mail className="h-3 w-3" />}
                        {tipoInteracaoLabel(i.tipo)}
                      </Badge>
                      <span>{new Date(i.data_hora).toLocaleString("pt-BR")}</span>
                      {i.autor?.nome && <span>· {i.autor.nome}</span>}
                    </div>
                    <p className="text-sm mt-1">{i.descricao}</p>
                  </div>
                ))}
                {!qInteracoes.data?.items?.length && !qInteracoes.isLoading && (
                  <p className="text-sm text-muted-foreground">Sem interações ainda.</p>
                )}
              </div>
              {qInteracoes.data?.hasMore && (
                <Button
                  variant="outline"
                  onClick={() => setInteracaoCursor(qInteracoes.data.nextCursor)}
                  disabled={qInteracoes.isLoading}
                  className="w-full"
                >
                  {qInteracoes.isLoading ? "Carregando..." : "Carregar mais"}
                </Button>
              )}
            </CardContent>
          </Card>
=======
          <TimelineSection projetoId={id} />
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
        </TabsContent>

        <TabsContent value="ia">
          <AiInsightsPanel projetoId={id} />
        </TabsContent>
      </Tabs>

      {/* FAB sempre visível para registrar nova interação */}
      <Dialog open={openInteracao} onOpenChange={setOpenInteracao}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 z-40 shadow-lg rounded-full h-14 px-6"
            aria-label="Registrar nova interação"
          >
            <MessageSquarePlus className="h-5 w-5 mr-2" />
            Registrar interação
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova interação</DialogTitle></DialogHeader>
          <InteracaoForm
            projetoId={id}
            onSaved={() => { setOpenInteracao(false); setTab("timeline"); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimelineSection({ projetoId }: { projetoId: string }) {
  const fn = useServerFn(getProjetoTimeline);
  const q = useQuery({
    queryKey: ["projeto-timeline", projetoId],
    queryFn: () => fn({ data: { id: projetoId } }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Linha do tempo</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <div className="text-sm text-destructive">
            Falha ao carregar a linha do tempo. <Button variant="link" className="p-0 h-auto" onClick={() => q.refetch()}>Tentar novamente</Button>
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed rounded-lg">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma interação ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Registre a primeira usando o botão <span className="font-medium">"Registrar interação"</span> no canto da tela.
            </p>
          </div>
        ) : (
          <ol className="relative border-l ml-4 space-y-6">
            {(q.data ?? []).map((i: any) => {
              const st = interacaoStyle(i.tipo);
              const Icon = st.icon;
              return (
                <li key={i.id} className="ml-6">
                  <span
                    className={cn(
                      "absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
                      st.dot,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={cn("border-transparent", st.badge)}>
                      {tipoInteracaoLabel(i.tipo)}
                    </Badge>
                    <span>{new Date(i.data_hora).toLocaleString("pt-BR")}</span>
                    {i.autor?.nome ? (
                      <span>· {i.autor.nome}</span>
                    ) : (
                      <span className="italic">· automático</span>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{i.descricao}</p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

type InteracaoStyle = {
  icon: React.ComponentType<{ className?: string }>;
  dot: string;
  badge: string;
};

function interacaoStyle(tipo: string): InteracaoStyle {
  // Auto = eventos gerados pelo sistema; Manual = registrados por pessoas
  switch (tipo) {
    case "email":
    case "email_encaminhado":
      return { icon: Mail, dot: "bg-sky-500 text-white", badge: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100" };
    case "documento":
      return { icon: FilePlus2, dot: "bg-violet-500 text-white", badge: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100" };
    case "alteracao_cronograma":
      return { icon: RefreshCw, dot: "bg-amber-500 text-white", badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" };
    case "aditivo_contratual":
      return { icon: FileText, dot: "bg-orange-500 text-white", badge: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100" };
    case "reuniao":
      return { icon: Users, dot: "bg-emerald-500 text-white", badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" };
    case "ligacao":
      return { icon: Phone, dot: "bg-teal-500 text-white", badge: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100" };
    case "nota":
      return { icon: StickyNote, dot: "bg-primary text-primary-foreground", badge: "bg-primary/10 text-primary" };
    default:
      return { icon: MessageSquare, dot: "bg-muted-foreground text-background", badge: "bg-muted text-foreground" };
  }
}

function InteracaoForm({ projetoId, onSaved }: { projetoId: string; onSaved: () => void }) {
  const criarInteracao = useServerFn(createInteracao);
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("nota");
  const [descricao, setDescricao] = useState("");

  const m = useMutation({
    mutationFn: () => criarInteracao({ data: { projeto_id: projetoId, tipo: tipo as any, descricao } }),
    onSuccess: () => {
      toast.success("Interação registrada");
      qc.invalidateQueries({ queryKey: ["projeto-timeline", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
      setDescricao("");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (descricao.trim()) m.mutate(); }}
      className="space-y-3"
    >
      <div>
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nota">Nota</SelectItem>
            <SelectItem value="reuniao">Reunião</SelectItem>
            <SelectItem value="ligacao">Ligação</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="alteracao_cronograma">Alteração de cronograma</SelectItem>
            <SelectItem value="aditivo_contratual">Aditivo contratual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={5}
          placeholder="O que aconteceu? Decisões, próximos passos, contexto…"
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={m.isPending || !descricao.trim()}>
          {m.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</>) : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
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

function MarcoForm({
  projetoId,
  onSubmit,
  loading,
}: {
  projetoId: string;
  onSubmit: (v: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [v, setV] = useState({
    projeto_id: projetoId,
    tipo: "relatorio_tecnico",
    descricao: "",
    data_prevista: "",
    responsavel_id: null as string | null,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ values: { ...v, descricao: v.descricao || null } });
      }}
      className="space-y-3"
    >
      <div>
        <Label>Tipo</Label>
        <Select value={v.tipo} onValueChange={(x: string) => setV({ ...v, tipo: x })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relatorio_tecnico">Relatório técnico</SelectItem>
            <SelectItem value="relatorio_financeiro">Relatório financeiro</SelectItem>
            <SelectItem value="prestacao_contas_parcial">Prestação de contas parcial</SelectItem>
            <SelectItem value="prestacao_contas_final">Prestação de contas final</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Data prevista</Label>
        <Input
          type="date"
          value={v.data_prevista}
          onChange={(e) => setV({ ...v, data_prevista: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

function MarcarEntregueDialog({
  marco,
  onConfirm,
}: {
  marco: Record<string, unknown>;
  onConfirm: (dt: string) => void;
}) {
  const [dt, setDt] = useState(new Date().toISOString().slice(0, 10));
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Marcar como entregue
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar entrega do marco</AlertDialogTitle>
          <AlertDialogDescription>
            {tipoMarcoLabel(marco.tipo)} · Previsto para {formatDate(marco.data_prevista)}. Confirme
            a data real de entrega — a comparação com a data prevista é registrada automaticamente
            na linha do tempo.
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
