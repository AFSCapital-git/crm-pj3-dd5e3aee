import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listUsuarios, reassignEmpresasConsultor } from "@/lib/dashboard.functions";
import {
  listConvites,
  criarConvite,
  reenviarConvite,
  revogarConvite,
  alterarPapel,
  setUsuarioStatus,
  listLogAuditoria,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
  Shield,
  UserCog,
  Users,
  Mail,
  Copy,
  Send,
  Ban,
  RefreshCw,
  Plus,
  ClipboardList,
  Search as SearchIcon,
  Clock,
  AlertTriangle,
  UserPlus,
  UserMinus,
  UserCheck,
  Ban as BanIcon,
  KeyRound,
  MailCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

// ---------- helpers ----------

function RoleBadge({ role }: { role: string }) {
  const roleMap: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    admin: {
      label: "Admin",
      icon: <Shield className="h-3 w-3" />,
      className: "bg-primary text-primary-foreground border-transparent",
    },
    coordenador: {
      label: "Coordenador",
      icon: <UserCog className="h-3 w-3" />,
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40",
    },
    projetista: {
      label: "Projetista",
      icon: <UserCog className="h-3 w-3" />,
      className: "bg-secondary text-secondary-foreground border-secondary",
    },
  };

  const config = roleMap[role] || roleMap.projetista;
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      {config.icon} {config.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    ativo: {
      label: "Ativo",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40",
      dot: "bg-emerald-500",
    },
    convidado: {
      label: "Convidado",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40",
      dot: "bg-amber-500",
    },
    desativado: {
      label: "Desativado",
      cls: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground/50",
    },
  };
  const m = map[status] ?? map.ativo;
  return (
    <Badge variant="outline" className={`gap-1.5 ${m.cls}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </Badge>
  );
}

function ConviteStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
    aceito: { label: "Aceito", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
    expirado: { label: "Expirado", cls: "bg-muted text-muted-foreground border-border" },
    revogado: {
      label: "Revogado",
      cls: "bg-destructive/15 text-destructive border-destructive/40",
    },
  };
  const m = map[status] ?? map.pendente;
  return (
    <Badge variant="outline" className={m.cls}>
      {m.label}
    </Badge>
  );
}

function statusRowClass(status: string) {
  switch (status) {
    case "ativo":
      return "border-l-4 border-l-emerald-500/70";
    case "convidado":
      return "border-l-4 border-l-amber-500/70";
    case "desativado":
      return "border-l-4 border-l-muted-foreground/40 opacity-70";
    default:
      return "";
  }
}

/** Contagem regressiva textual + flag de urgência. */
function expiracaoInfo(iso: string): { texto: string; tone: "ok" | "warn" | "danger" | "expired" } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { texto: "Expirado", tone: "expired" };
  const dias = Math.floor(ms / 86400000);
  const horas = Math.floor((ms % 86400000) / 3600000);
  if (dias >= 3) return { texto: `expira em ${dias} dias`, tone: "ok" };
  if (dias >= 1) return { texto: `expira em ${dias} dia${dias > 1 ? "s" : ""}`, tone: "warn" };
  if (horas >= 1) return { texto: `expira em ${horas}h`, tone: "danger" };
  const min = Math.max(1, Math.floor(ms / 60000));
  return { texto: `expira em ${min}min`, tone: "danger" };
}

function ExpiracaoBadge({ iso }: { iso: string }) {
  const info = expiracaoInfo(iso);
  const cls =
    info.tone === "ok"
      ? "bg-muted text-muted-foreground border-border"
      : info.tone === "warn"
        ? "bg-amber-500/15 text-amber-700 border-amber-500/40"
        : info.tone === "danger"
          ? "bg-destructive/15 text-destructive border-destructive/40"
          : "bg-destructive/15 text-destructive border-destructive/40";
  return (
    <Badge variant="outline" className={`gap-1 ${cls}`}>
      <Clock className="h-3 w-3" /> {info.texto}
    </Badge>
  );
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Frase legível para cada entrada de auditoria
function descreverLog(l: any): { icon: React.ReactNode; frase: React.ReactNode } {
  const executor = <strong>{l.executor_nome ?? "Sistema"}</strong>;
  const d = l.detalhes_da_acao ?? {};
  const alvoNome = l.afetado_nome ?? d.email ?? "usuário";
  const alvo = <strong>{alvoNome}</strong>;
  const papel = d.papel ?? d.para ?? "usuário";
  const quando = fmtDataCurta(l.data_hora);

  switch (l.acao) {
    case "convite_enviado":
      return {
        icon: <UserPlus className="h-4 w-4 text-amber-600" />,
        frase: (
          <>
            {executor} convidou {alvo} como <em>{papel}</em> em {quando}
          </>
        ),
      };
    case "convite_reenviado":
      return {
        icon: <RefreshCw className="h-4 w-4 text-amber-600" />,
        frase: (
          <>
            {executor} reenviou o convite para {alvo} em {quando}
          </>
        ),
      };
    case "convite_revogado":
      return {
        icon: <BanIcon className="h-4 w-4 text-destructive" />,
        frase: (
          <>
            {executor} revogou o convite de {alvo} em {quando}
          </>
        ),
      };
    case "convite_aceito":
      return {
        icon: <MailCheck className="h-4 w-4 text-emerald-600" />,
        frase: (
          <>
            {alvo} aceitou o convite como <em>{papel}</em> em {quando}
          </>
        ),
      };
    case "papel_alterado":
      return {
        icon: <KeyRound className="h-4 w-4 text-primary" />,
        frase: (
          <>
            {executor} alterou o papel de {alvo}
            {d.de ? (
              <>
                {" "}
                de <em>{d.de}</em>
              </>
            ) : null}{" "}
            para <em>{d.para}</em> em {quando}
          </>
        ),
      };
    case "usuario_desativado":
      return {
        icon: <UserMinus className="h-4 w-4 text-destructive" />,
        frase: (
          <>
            {executor} desativou {alvo} em {quando}
          </>
        ),
      };
    case "usuario_reativado":
      return {
        icon: <UserCheck className="h-4 w-4 text-emerald-600" />,
        frase: (
          <>
            {executor} reativou {alvo} em {quando}
          </>
        ),
      };
    default:
      return {
        icon: <ClipboardList className="h-4 w-4 text-muted-foreground" />,
        frase: (
          <>
            {executor} executou <em>{l.acao}</em> em {quando}
          </>
        ),
      };
  }
}

const ACAO_LABEL: Record<string, string> = {
  convite_enviado: "Convite enviado",
  convite_reenviado: "Convite reenviado",
  convite_revogado: "Convite revogado",
  convite_aceito: "Convite aceito",
  papel_alterado: "Papel alterado",
  usuario_desativado: "Usuário desativado",
  usuario_reativado: "Usuário reativado",
};

// ---------- página ----------

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  status: string;
  ativo: boolean;
  ultimo_login: string | null;
  roles: string[];
  empresas_count: number;
};

function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground">
          Usuários, permissões, convites e trilha de auditoria. Acesso restrito a administradores.
        </p>
      </div>
      <Tabs defaultValue="usuarios">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="usuarios" className="gap-1">
            <Users className="h-4 w-4" /> <span className="hidden sm:inline">Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="convites" className="gap-1">
            <Mail className="h-4 w-4" /> <span className="hidden sm:inline">Convites</span>
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1">
            <ClipboardList className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-4">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="convites" className="mt-4">
          <ConvitesTab />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <LogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ USUÁRIOS ============

function UsuariosTab() {
  const listFn = useServerFn(listUsuarios);
  const reassignFn = useServerFn(reassignEmpresasConsultor);
  const setStatusFn = useServerFn(setUsuarioStatus);
  const alterarPapelFn = useServerFn(alterarPapel);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-usuarios"], queryFn: () => listFn() });
  const users = (q.data ?? []) as unknown as UsuarioRow[];

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroPapel, setFiltroPapel] = useState<string>("todos");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filtroStatus !== "todos" && u.status !== filtroStatus) return false;
      if (filtroPapel !== "todos" && !u.roles.includes(filtroPapel)) return false;
      if (busca.trim()) {
        const t = busca.toLowerCase();
        if (!u.nome.toLowerCase().includes(t) && !u.email.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [users, busca, filtroStatus, filtroPapel]);

  // Confirmação para desativar (sempre, mesmo sem carteira)
  const [confirmDeactivate, setConfirmDeactivate] = useState<UsuarioRow | null>(null);
  const [reassigning, setReassigning] = useState<UsuarioRow | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [novoPapel, setNovoPapel] = useState<"admin" | "coordenador" | "projetista">("projetista");

  const mStatus = useMutation({
    mutationFn: (v: { user_id: string; status: "ativo" | "desativado" }) =>
      setStatusFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.status === "ativo" ? "Usuário reativado" : "Usuário desativado");
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mReassign = useMutation({
    mutationFn: (v: { from_user_id: string; to_user_id: string }) => reassignFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`${r.count} cliente(s) reatribuído(s)`);
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      setReassigning(null);
      setReassignTo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mPapel = useMutation({
    mutationFn: (v: {
      user_id: string;
      papel: "admin" | "coordenador" | "projetista";
      coordenador_id?: string | null;
      ve_todos_projetos?: boolean;
    }) => alterarPapelFn({ data: v }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
      setEditing(null);
      setCoordenadorId(null);
      setVeTodosProjetos(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeConsultores = users.filter((u) => u.status === "ativo" && u.id !== reassigning?.id);

  function pedirDesativacao(u: UsuarioRow) {
    setConfirmDeactivate(u);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label>Buscar</Label>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome ou e-mail"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-3">
            <div>
              <Label>Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="convidado">Convidado</SelectItem>
                  <SelectItem value="desativado">Desativado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={filtroPapel} onValueChange={setFiltroPapel}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coordenador">Coordenador</SelectItem>
                  <SelectItem value="projetista">Projetista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Usuários ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p>Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum usuário encontrado com esses filtros.
            </p>
          ) : (
            <>
              {/* Tabela desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Último login</TableHead>
                      <TableHead>Carteira</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => (
                      <TableRow key={u.id} className={statusRowClass(u.status)}>
                        <TableCell className="font-medium">{u.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="space-x-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            u.roles.map((r) => <RoleBadge key={r} role={r} />)
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.ultimo_login ? fmtData(u.ultimo_login) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {u.empresas_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={u.status === "ativo"}
                              disabled={mStatus.isPending}
                              onCheckedChange={(v) => {
                                if (!v) pedirDesativacao(u);
                                else mStatus.mutate({ user_id: u.id, status: "ativo" });
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditing(u);
                                if (u.roles.includes("admin")) {
                                  setNovoPapel("admin");
                                } else if (u.roles.includes("coordenador")) {
                                  setNovoPapel("coordenador");
                                  setVeTodosProjetos(u.ve_todos_projetos || false);
                                } else {
                                  setNovoPapel("projetista");
                                  setCoordenadorId(u.coordenador_id || null);
                                }
                              }}
                            >
                              Editar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cards mobile */}
              <div className="md:hidden space-y-3">
                {filtered.map((u) => (
                  <div
                    key={u.id}
                    className={`rounded-lg border bg-card p-3 ${statusRowClass(u.status)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <StatusBadge status={u.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem papel</span>
                      ) : (
                        u.roles.map((r) => <RoleBadge key={r} role={r} />)
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {u.empresas_count} clientes
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Último login: {u.ultimo_login ? fmtData(u.ultimo_login) : "—"}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={u.status === "ativo"}
                          disabled={mStatus.isPending}
                          onCheckedChange={(v) => {
                            if (!v) pedirDesativacao(u);
                            else mStatus.mutate({ user_id: u.id, status: "ativo" });
                          }}
                        />
                        {u.status === "ativo" ? "Ativo" : "Desativado"}
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(u);
                          if (u.roles.includes("admin")) {
                            setNovoPapel("admin");
                          } else if (u.roles.includes("coordenador")) {
                            setNovoPapel("coordenador");
                            setVeTodosProjetos(u.ve_todos_projetos || false);
                          } else {
                            setNovoPapel("projetista");
                            setCoordenadorId(u.coordenador_id || null);
                          }
                        }}
                      >
                        Editar papel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmação de desativação (sempre) */}
      <AlertDialog
        open={!!confirmDeactivate}
        onOpenChange={(o) => !o && setConfirmDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Desativar {confirmDeactivate?.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Ao confirmar, este usuário:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Terá a <strong>sessão encerrada imediatamente</strong> e não poderá mais acessar
                    o sistema.
                  </li>
                  {(confirmDeactivate?.empresas_count ?? 0) > 0 ? (
                    <li>
                      Deixará <strong>{confirmDeactivate?.empresas_count} cliente(s)</strong> sem
                      consultor ativo — você será levado à tela de reatribuição em seguida.
                    </li>
                  ) : (
                    <li>Não possui carteira de clientes — nenhuma reatribuição será necessária.</li>
                  )}
                  <li>Poderá ser reativado depois; o histórico é sempre preservado.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmDeactivate) return;
                const u = confirmDeactivate;
                mStatus.mutate({ user_id: u.id, status: "desativado" });
                if (u.empresas_count > 0) setReassigning(u);
                setConfirmDeactivate(null);
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reatribuição */}
      <Dialog
        open={!!reassigning}
        onOpenChange={(o) => {
          if (!o) {
            setReassigning(null);
            setReassignTo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reatribuir carteira de {reassigning?.nome}</DialogTitle>
            <DialogDescription>
              Os <strong>{reassigning?.empresas_count} cliente(s)</strong> serão transferidos para
              outro consultor ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo consultor</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um consultor ativo" />
              </SelectTrigger>
              <SelectContent>
                {activeConsultores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} ({u.empresas_count} clientes)
                  </SelectItem>
                ))}
                {activeConsultores.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum outro consultor ativo.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setReassigning(null);
                setReassignTo("");
              }}
            >
              Depois
            </Button>
            <Button
              disabled={!reassignTo || mReassign.isPending}
              onClick={() => {
                if (reassigning && reassignTo)
                  mReassign.mutate({ from_user_id: reassigning.id, to_user_id: reassignTo });
              }}
            >
              {mReassign.isPending ? "Reatribuindo…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar papel */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.nome}</DialogTitle>
            <DialogDescription>
              Altere o papel do usuário. Não é possível remover o papel admin do último
              administrador ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Papel</Label>
              <Select value={novoPapel} onValueChange={(v: any) => setNovoPapel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coordenador">Coordenador</SelectItem>
                  <SelectItem value="projetista">Projetista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {novoPapel === "projetista" && (
              <div>
                <Label>Coordenador responsável</Label>
                <Select
                  value={coordenadorId || ""}
                  onValueChange={(v) => setCoordenadorId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um coordenador" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => u.roles.includes("coordenador") && u.status === "ativo")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {novoPapel === "coordenador" && (
              <div className="flex items-center gap-3">
                <Switch
                  id="ve-todos"
                  checked={veTodosProjetos}
                  onCheckedChange={setVeTodosProjetos}
                />
                <Label htmlFor="ve-todos" className="font-normal cursor-pointer">
                  Este coordenador vê todos os projetos
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mPapel.isPending}
              onClick={() => {
                if (editing) {
                  mPapel.mutate({
                    user_id: editing.id,
                    papel: novoPapel,
                    coordenador_id: novoPapel === "projetista" ? coordenadorId : undefined,
                    ve_todos_projetos: novoPapel === "coordenador" ? veTodosProjetos : undefined,
                  });
                }
              }}
            >
              {mPapel.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ CONVITES ============

function ConvitesTab() {
  const listFn = useServerFn(listConvites);
  const criarFn = useServerFn(criarConvite);
  const criarDiretoFn = useServerFn(criarUsuarioDireto);
  const reenviarFn = useServerFn(reenviarConvite);
  const revogarFn = useServerFn(revogarConvite);
  const qc = useQueryClient();
  const listUsuariosFn = useServerFn(listUsuarios);
  const qUsuarios = useQuery({ queryKey: ["admin-usuarios"], queryFn: () => listUsuariosFn() });
  const users = (qUsuarios.data ?? []) as UsuarioRow[];
  const q = useQuery({ queryKey: ["admin-convites"], queryFn: () => listFn() });
  const convites = (q.data ?? []) as any[];

  const [openNovo, setOpenNovo] = useState(false);
  const [openCadastroDireto, setOpenCadastroDireto] = useState(false);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"admin" | "coordenador" | "projetista">("projetista");
  const [nome, setNome] = useState("");
  const [coordenadorIdConvite, setCoordenadorIdConvite] = useState<string | null>(null);
  const [veTodosProjetosConvite, setVeTodosProjetosConvite] = useState(false);
  const [senhaTemporaria, setSenhaTemporaria] = useState<{ senha: string; email: string } | null>(
    null
  );
  const [linkGerado, setLinkGerado] = useState<{ link: string; email: string } | null>(null);
  const [confirmRevogar, setConfirmRevogar] = useState<any | null>(null);

  function buildLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/aceitar-convite?token=${encodeURIComponent(token)}`;
  }

  const mCriar = useMutation({
    mutationFn: () =>
      criarFn({
        data: {
          email,
          papel,
          nome: nome || undefined,
          coordenador_id: papel === "projetista" ? coordenadorIdConvite : undefined,
          ve_todos_projetos: papel === "coordenador" ? veTodosProjetosConvite : undefined,
        },
      }),
    onSuccess: (r: any) => {
      const link = buildLink(r.token);
      setLinkGerado({ link, email: r.convite.email_convidado });
      setEmail("");
      setNome("");
      setPapel("projetista");
      setCoordenadorIdConvite(null);
      setVeTodosProjetosConvite(false);
      setOpenNovo(false);
      qc.invalidateQueries({ queryKey: ["admin-convites"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mCriarDireto = useMutation({
    mutationFn: () =>
      criarDiretoFn({
        data: {
          email,
          papel,
          nome,
          coordenador_id: papel === "projetista" ? coordenadorIdConvite : undefined,
          ve_todos_projetos: papel === "coordenador" ? veTodosProjetosConvite : undefined,
        },
      }),
    onSuccess: (r: any) => {
      setSenhaTemporaria({ senha: r.senhaTemporaria, email: r.email });
      setEmail("");
      setNome("");
      setPapel("projetista");
      setCoordenadorIdConvite(null);
      setVeTodosProjetosConvite(false);
      setOpenCadastroDireto(false);
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin-convites"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mReenviar = useMutation({
    mutationFn: (id: string) => reenviarFn({ data: { id } }),
    onSuccess: (r: any) => {
      const link = buildLink(r.token);
      setLinkGerado({ link, email: r.email });
      qc.invalidateQueries({ queryKey: ["admin-convites"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
      toast.success("Novo link gerado — o link anterior foi invalidado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mRevogar = useMutation({
    mutationFn: (id: string) => revogarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Convite revogado");
      qc.invalidateQueries({ queryKey: ["admin-convites"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
      setConfirmRevogar(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function copyLink() {
    if (!linkGerado) return;
    await navigator.clipboard.writeText(linkGerado.link);
    toast.success("Link copiado");
  }

  async function copiarSenha() {
    if (!senhaTemporaria) return;
    await navigator.clipboard.writeText(senhaTemporaria.senha);
    toast.success("Senha copiada");
  }

  const pendentes = convites.filter((c) => c.status === "pendente");
  const historico = convites.filter((c) => c.status !== "pendente");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-end">
        <Button onClick={() => setOpenCadastroDireto(true)} variant="outline" className="gap-1">
          <Plus className="h-4 w-4" /> Cadastrar usuário
        </Button>
        <Button onClick={() => setOpenNovo(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Convidar usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Convites pendentes ({pendentes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum convite pendente.
            </p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.email_convidado}</TableCell>
                        <TableCell>
                          <RoleBadge role={c.papel_designado} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtData(c.criado_em)}
                        </TableCell>
                        <TableCell>
                          <ExpiracaoBadge iso={c.data_expiracao} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mReenviar.isPending}
                              onClick={() => mReenviar.mutate(c.id)}
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setConfirmRevogar(c)}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" /> Revogar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {pendentes.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border bg-card p-3 border-l-4 border-l-amber-500/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium break-all">{c.email_convidado}</div>
                        <div className="mt-1">
                          <RoleBadge role={c.papel_designado} />
                        </div>
                      </div>
                      <ExpiracaoBadge iso={c.data_expiracao} />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Enviado em {fmtData(c.criado_em)}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={mReenviar.isPending}
                        onClick={() => mReenviar.mutate(c.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-destructive"
                        onClick={() => setConfirmRevogar(c)}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Revogar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de convites</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Aceito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.email_convidado}</TableCell>
                      <TableCell>
                        <RoleBadge role={c.papel_designado} />
                      </TableCell>
                      <TableCell>
                        <ConviteStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtData(c.criado_em)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.aceito_em ? fmtData(c.aceito_em) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {historico.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-medium break-all">{c.email_convidado}</div>
                    <ConviteStatusBadge status={c.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <RoleBadge role={c.papel_designado} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Enviado {fmtData(c.criado_em)}
                    {c.aceito_em ? ` · Aceito ${fmtData(c.aceito_em)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Novo convite */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar novo usuário</DialogTitle>
            <DialogDescription>
              O convidado receberá um link único para definir a própria senha. O link expira em 7
              dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Nome (opcional)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={papel} onValueChange={(v: any) => setPapel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coordenador">Coordenador</SelectItem>
                  <SelectItem value="projetista">Projetista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {papel === "projetista" && (
              <div>
                <Label>Coordenador responsável</Label>
                <Select
                  value={coordenadorIdConvite || ""}
                  onValueChange={(v) => setCoordenadorIdConvite(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um coordenador" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => u.roles.includes("coordenador") && u.status === "ativo")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {papel === "coordenador" && (
              <div className="flex items-center gap-3">
                <Switch
                  id="ve-todos-convite"
                  checked={veTodosProjetosConvite}
                  onCheckedChange={setVeTodosProjetosConvite}
                />
                <Label htmlFor="ve-todos-convite" className="font-normal cursor-pointer">
                  Este coordenador vê todos os projetos
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNovo(false)}>
              Cancelar
            </Button>
            <Button disabled={!email || mCriar.isPending} onClick={() => mCriar.mutate()}>
              <Send className="h-4 w-4 mr-1" />
              {mCriar.isPending ? "Gerando…" : "Gerar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro direto */}
      <Dialog open={openCadastroDireto} onOpenChange={setOpenCadastroDireto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar novo usuário</DialogTitle>
            <DialogDescription>
              O usuário será criado imediatamente com uma senha temporária que deve ser trocada no
              primeiro login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={papel} onValueChange={(v: any) => setPapel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coordenador">Coordenador</SelectItem>
                  <SelectItem value="projetista">Projetista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {papel === "projetista" && (
              <div>
                <Label>Coordenador responsável</Label>
                <Select
                  value={coordenadorIdConvite || ""}
                  onValueChange={(v) => setCoordenadorIdConvite(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um coordenador" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => u.roles.includes("coordenador") && u.status === "ativo")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {papel === "coordenador" && (
              <div className="flex items-center gap-3">
                <Switch
                  id="ve-todos-cadastro"
                  checked={veTodosProjetosConvite}
                  onCheckedChange={setVeTodosProjetosConvite}
                />
                <Label htmlFor="ve-todos-cadastro" className="font-normal cursor-pointer">
                  Este coordenador vê todos os projetos
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCadastroDireto(false)}>
              Cancelar
            </Button>
            <Button disabled={!nome || !email || mCriarDireto.isPending} onClick={() => mCriarDireto.mutate()}>
              {mCriarDireto.isPending ? "Criando…" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senha temporária */}
      <Dialog open={!!senhaTemporaria} onOpenChange={(o) => !o && setSenhaTemporaria(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado com sucesso</DialogTitle>
            <DialogDescription>
              Anote ou copie a senha temporária abaixo. O usuário deve trocá-la no primeiro login.
              Esta senha <strong>não aparecerá novamente</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <div className="rounded-md border bg-muted/40 p-3 text-sm font-medium break-all">
                {senhaTemporaria?.email}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Senha temporária</Label>
              <div className="rounded-md border bg-muted/40 p-3 text-sm font-mono break-all">
                {senhaTemporaria?.senha}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copiarSenha} className="gap-1">
              <Copy className="h-4 w-4" /> Copiar senha
            </Button>
            <Button onClick={() => setSenhaTemporaria(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link gerado */}
      <Dialog open={!!linkGerado} onOpenChange={(o) => !o && setLinkGerado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convite pronto</DialogTitle>
            <DialogDescription>
              Envie este link para <strong>{linkGerado?.email}</strong>. O link é único e expira em
              7 dias. Ele será invalidado automaticamente se o convite for reenviado ou revogado.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono break-all">
            {linkGerado?.link}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyLink} className="gap-1">
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <Button onClick={() => setLinkGerado(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar revogação */}
      <AlertDialog open={!!confirmRevogar} onOpenChange={(o) => !o && setConfirmRevogar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revogar convite de {confirmRevogar?.email_convidado}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Ao confirmar:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    O link enviado deixa de funcionar <strong>imediatamente</strong>.
                  </li>
                  <li>
                    O convidado <strong>não poderá</strong> mais definir senha nem acessar o sistema
                    por este convite.
                  </li>
                  <li>
                    O convite ficará registrado no histórico como <em>revogado</em>.
                  </li>
                  <li>Você pode gerar um novo convite para o mesmo e-mail depois.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={mRevogar.isPending}
              onClick={() => confirmRevogar && mRevogar.mutate(confirmRevogar.id)}
            >
              {mRevogar.isPending ? "Revogando…" : "Revogar convite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ LOG ============

function LogTab() {
  const listFn = useServerFn(listLogAuditoria);
  const [filtroAcao, setFiltroAcao] = useState<string>("todas");
  const q = useQuery({
    queryKey: ["admin-log", filtroAcao],
    queryFn: () => listFn({ data: filtroAcao === "todas" ? {} : { acao: filtroAcao } }),
  });
  const logs = (q.data ?? []) as any[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Log de auditoria</CardTitle>
          <CardDescription>
            Registro imutável de ações administrativas. Não pode ser editado nem apagado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Filtrar por ação</Label>
            <Select value={filtroAcao} onValueChange={setFiltroAcao}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {Object.entries(ACAO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {q.isLoading ? (
            <p>Carregando…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum registro encontrado.
            </p>
          ) : (
            <ul className="divide-y">
              {logs.map((l) => {
                const { icon, frase } = descreverLog(l);
                return (
                  <li key={l.id} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 shrink-0 grid h-8 w-8 place-items-center rounded-full bg-muted">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{frase}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(l.data_hora).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
