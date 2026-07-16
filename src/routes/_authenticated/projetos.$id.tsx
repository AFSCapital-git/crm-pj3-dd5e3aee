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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Plus,
  Trash2,
  Mail,
  MessageSquare,
  StickyNote,
  Phone,
  Users,
  FileText,
  RefreshCw,
  FilePlus2,
  MessageSquarePlus,
  Loader2,
  Inbox,
  Edit2,
} from "lucide-react";
import { getProjeto, getProjetoTimeline, listInteracoesPaginado, toggleInteracaoDestaque } from "@/lib/projetos.functions";
import { listDiscussao, createMensagem, updateMensagem, deleteMensagem } from "@/lib/discussao.functions";
import { listTarefas, upsertTarefa, concluirTarefa, deleteTarefa } from "@/lib/tarefas.functions";
import { upsertMarco, marcarEntregue, deleteMarco, createInteracao } from "@/lib/marcos.functions";
import { listUsuarios } from "@/lib/usuarios.functions";
import { getCurrentUser } from "@/lib/auth.functions";
import {
  UrgencyBadge,
  formatBRL,
  formatDate,
  statusProjetoLabel,
  tipoMarcoLabel,
  tipoInteracaoLabel,
  statusTarefaLabel,
  prioridadeTarefaLabel,
} from "@/lib/labels";
import { DocumentosTab } from "@/components/documentos-tab";
import { EmailsTab } from "@/components/emails-tab";
import { AiInsightsPanel } from "@/components/ai-insights-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  component: ProjetoDetail,
});

function DiscussaoSection({ projetoId, userId }: { projetoId: string; userId: string }) {
  const fn = useServerFn(listDiscussao);
  const fnCreate = useServerFn(createMensagem);
  const fnUpdate = useServerFn(updateMensagem);
  const fnDelete = useServerFn(deleteMensagem);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["discussao", projetoId],
    queryFn: () => fn({ data: { projeto_id: projetoId } }),
    refetchInterval: 15000,
  });

  const [novaMsg, setNovaMsg] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoTexto, setEditandoTexto] = useState("");

  const mCreate = useMutation({
    mutationFn: (msg: string) => fnCreate({ data: { projeto_id: projetoId, mensagem: msg } }),
    onSuccess: () => {
      toast.success("Mensagem enviada");
      qc.invalidateQueries({ queryKey: ["discussao", projetoId] });
      setNovaMsg("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mUpdate = useMutation({
    mutationFn: (msg: string) => fnUpdate({ data: { id: editandoId!, mensagem: msg } }),
    onSuccess: () => {
      toast.success("Editado");
      qc.invalidateQueries({ queryKey: ["discussao", projetoId] });
      setEditandoId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => fnDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["discussao", projetoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleEnviar = () => {
    if (!novaMsg.trim()) return;
    mCreate.mutate(novaMsg);
  };

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col gap-4 max-h-[500px] overflow-y-auto">
        {q.isLoading ? (
          <p>Carregando…</p>
        ) : (q.data ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhuma mensagem ainda</div>
        ) : (
          <div className="space-y-3">
            {(q.data ?? []).map((m: any) => (
              <div key={m.id} className="border rounded p-3 bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{m.autor?.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </span>
                      {m.editado_em && (
                        <span className="text-xs text-muted-foreground italic">(editado)</span>
                      )}
                    </div>
                    {editandoId === m.id ? (
                      <textarea
                        value={editandoTexto}
                        onChange={(e) => setEditandoTexto(e.target.value)}
                        className="mt-2 w-full border rounded p-2"
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm mt-1 whitespace-pre-wrap">{m.mensagem}</p>
                    )}
                  </div>
                  {m.autor_id === userId && (
                    <div className="flex gap-1">
                      {editandoId === m.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => mUpdate.mutate(editandoTexto)}
                            disabled={mUpdate.isPending}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditandoId(m.id);
                              setEditandoTexto(m.mensagem);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => mDelete.mutate(m.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="border-t p-4 flex gap-2">
        <Input
          placeholder="Digite sua mensagem…"
          value={novaMsg}
          onChange={(e) => setNovaMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleEnviar()}
          disabled={mCreate.isPending}
        />
        <Button onClick={handleEnviar} disabled={mCreate.isPending || !novaMsg.trim()}>
          Enviar
        </Button>
      </div>
    </Card>
  );
}

function TarefasSection({
  projetoId,
  usuariosList,
}: {
  projetoId: string;
  usuariosList: any[];
}) {
  const fn = useServerFn(listTarefas);
  const fnUpsert = useServerFn(upsertTarefa);
  const fnConcluir = useServerFn(concluirTarefa);
  const fnDelete = useServerFn(deleteTarefa);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["tarefas", projetoId],
    queryFn: () => fn({ data: { projeto_id: projetoId } }),
  });

  const [open, setOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("");

  const mUpsert = useMutation({
    mutationFn: (v: any) => fnUpsert({ data: v }),
    onSuccess: () => {
      toast.success("Tarefa salva");
      qc.invalidateQueries({ queryKey: ["tarefas", projetoId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mConcluir = useMutation({
    mutationFn: (id: string) => fnConcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Tarefa concluída");
      qc.invalidateQueries({ queryKey: ["tarefas", projetoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => fnDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["tarefas", projetoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tarefas = q.data ?? [];
  const filtradas = filtroStatus ? tarefas.filter((t: any) => t.status === filtroStatus) : tarefas;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Tarefas</CardTitle>
          <Select value={filtroStatus || "todos"} onValueChange={(v) => setFiltroStatus(v === "todos" ? "" : v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova tarefa</DialogTitle>
            </DialogHeader>
            <TarefaForm
              projetoId={projetoId}
              usuariosList={usuariosList}
              onSubmit={(v: any) => mUpsert.mutate({ projeto_id: projetoId, values: v })}
              loading={mUpsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p>Carregando…</p>
        ) : filtradas.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma tarefa nesta categoria</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titulo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.titulo}</TableCell>
                  <TableCell>{t.responsavel?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {prioridadeTarefaLabel(t.prioridade)}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.data_prazo ? formatDate(t.data_prazo) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{statusTarefaLabel(t.status)}</Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    {t.status !== "concluida" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => mConcluir.mutate(t.id)}
                        disabled={mConcluir.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => mDelete.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TarefaForm({
  projetoId,
  usuariosList,
  onSubmit,
  loading,
}: {
  projetoId: string;
  usuariosList: any[];
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataPrazo, setDataPrazo] = useState("");

  const handleSubmit = () => {
    if (!titulo.trim()) return;
    onSubmit({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      responsavel_id: responsavelId || null,
      prioridade,
      status: "pendente",
      data_prazo: dataPrazo || null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Responsável</Label>
          <Select value={responsavelId} onValueChange={setResponsavelId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {usuariosList.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Prioridade</Label>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Prazo</Label>
        <Input type="date" value={dataPrazo} onChange={(e) => setDataPrazo(e.target.value)} />
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={loading || !titulo.trim()}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}

function ProjetoDetail() {
  const { id } = useParams({ from: "/_authenticated/projetos/$id" });
  const fn = useServerFn(getProjeto);
  const fnUsuarios = useServerFn(listUsuarios);
  const fnGetUser = useServerFn(getCurrentUser);
  const q = useQuery({ queryKey: ["projeto", id], queryFn: () => fn({ data: { id } }) });
  const qUsuarios = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => fnUsuarios({ data: {} }),
  });
  const qMe = useQuery({
    queryKey: ["me"],
    queryFn: () => fnGetUser(),
  });
  const qc = useQueryClient();

  const userId = qMe.data?.id ?? "";

  const upsert = useServerFn(upsertMarco);
  const marcar = useServerFn(marcarEntregue);
  const del = useServerFn(deleteMarco);

  const [openMarco, setOpenMarco] = useState(false);
  const [openInteracao, setOpenInteracao] = useState(false);
  const [tab, setTab] = useState("dados");

  const mUpsertMarco = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => {
      toast.success("Marco salvo");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
      setOpenMarco(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mMarcar = useMutation({
    mutationFn: (v: any) => marcar({ data: v }),
    onSuccess: () => {
      toast.success("Marco entregue");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelMarco = useMutation({
    mutationFn: (mid: string) => del({ data: { id: mid } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["projeto", id] });
    },
  });

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
          <TabsTrigger value="discussao">Discussão</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
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
                    onSubmit={(v: any) => mUpsertMarco.mutate(v)}
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
                  {marcos.map((m: any) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
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
          <TimelineSection projetoId={id} />
        </TabsContent>

        <TabsContent value="discussao">
          <DiscussaoSection projetoId={id} userId={userId} />
        </TabsContent>

        <TabsContent value="tarefas">
          <TarefasSection projetoId={id} usuariosList={qUsuarios.data ?? []} />
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
          <DialogHeader>
            <DialogTitle>Nova interação</DialogTitle>
          </DialogHeader>
          <InteracaoForm
            projetoId={id}
            onSaved={() => {
              setOpenInteracao(false);
              setTab("timeline");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimelineSection({ projetoId }: { projetoId: string }) {
  const fn = useServerFn(listInteracoesPaginado);
  const fnToggleDestaque = useServerFn(toggleInteracaoDestaque);
  const qc = useQueryClient();

  const [pagina, setPagina] = useState(1);

  const q = useQuery({
    queryKey: ["projeto-timeline", projetoId, pagina],
    queryFn: () =>
      fn({
        data: {
          projeto_id: projetoId,
          cursor: pagina === 1 ? null : new Date(Date.now() - pagina * 20 * 60000).toISOString(),
          pageSize: 20,
        },
      }),
  });

  const mToggleDestaque = useMutation({
    mutationFn: (id: string) => fnToggleDestaque({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto-timeline", projetoId, pagina] });
    },
  });

  const items = (q.data?.items ?? []) as any[];
  const destacados = items.filter((i: any) => i.destacado);
  const naoDestacados = items.filter((i: any) => !i.destacado);
  const todasInteracoes = [...destacados, ...naoDestacados];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linha do tempo</CardTitle>
      </CardHeader>
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
            Falha ao carregar a linha do tempo.{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => q.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : todasInteracoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed rounded-lg">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma interação ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Registre a primeira usando o botão{" "}
              <span className="font-medium">"Registrar interação"</span> no canto da tela.
            </p>
          </div>
        ) : (
          <>
            <ol className="relative border-l ml-4 space-y-6">
              {todasInteracoes.map((i: any) => {
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Badge variant="outline" className={cn("border-transparent", st.badge)}>
                        {tipoInteracaoLabel(i.tipo)}
                      </Badge>
                      <span>{new Date(i.data_hora).toLocaleString("pt-BR")}</span>
                      {i.autor?.nome ? (
                        <span>· {i.autor.nome}</span>
                      ) : (
                        <span className="italic">· automático</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto p-0"
                        onClick={() => mToggleDestaque.mutate(i.id)}
                      >
                        {i.destacado ? "📌" : "📍"}
                      </Button>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{i.descricao}</p>
                  </li>
                );
              })}
            </ol>
            {q.data?.hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPagina(pagina + 1)}
                  disabled={q.isLoading}
                >
                  Carregar mais
                </Button>
              </div>
            )}
          </>
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
      return {
        icon: Mail,
        dot: "bg-sky-500 text-white",
        badge: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
      };
    case "documento":
      return {
        icon: FilePlus2,
        dot: "bg-violet-500 text-white",
        badge: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
      };
    case "alteracao_cronograma":
      return {
        icon: RefreshCw,
        dot: "bg-amber-500 text-white",
        badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
      };
    case "aditivo_contratual":
      return {
        icon: FileText,
        dot: "bg-orange-500 text-white",
        badge: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
      };
    case "reuniao":
      return {
        icon: Users,
        dot: "bg-emerald-500 text-white",
        badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
      };
    case "ligacao":
      return {
        icon: Phone,
        dot: "bg-teal-500 text-white",
        badge: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100",
      };
    case "nota":
      return {
        icon: StickyNote,
        dot: "bg-primary text-primary-foreground",
        badge: "bg-primary/10 text-primary",
      };
    default:
      return {
        icon: MessageSquare,
        dot: "bg-muted-foreground text-background",
        badge: "bg-muted text-foreground",
      };
  }
}

function InteracaoForm({ projetoId, onSaved }: { projetoId: string; onSaved: () => void }) {
  const criarInteracao = useServerFn(createInteracao);
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("nota");
  const [descricao, setDescricao] = useState("");

  const m = useMutation({
    mutationFn: () =>
      criarInteracao({ data: { projeto_id: projetoId, tipo: tipo as any, descricao } }),
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
      onSubmit={(e) => {
        e.preventDefault();
        if (descricao.trim()) m.mutate();
      }}
      className="space-y-3"
    >
      <div>
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
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
          {m.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
            </>
          ) : (
            "Registrar"
          )}
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

function MarcoForm({ projetoId, onSubmit, loading }: any) {
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
        <Select value={v.tipo} onValueChange={(x) => setV({ ...v, tipo: x as any })}>
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
  marco: any;
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
