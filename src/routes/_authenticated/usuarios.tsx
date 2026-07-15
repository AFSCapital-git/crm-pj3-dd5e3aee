import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listUsuarios,
  reassignEmpresasConsultor,
} from "@/lib/dashboard.functions";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield, UserCog, Users, Mail, Copy, Send, Ban, RefreshCw, Plus,
  ClipboardList, Search as SearchIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

// ---------- helpers de UI ----------

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <Badge className="gap-1 border-transparent bg-primary text-primary-foreground">
        <Shield className="h-3 w-3" /> Admin
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <UserCog className="h-3 w-3" /> Consultor
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
    convidado: { label: "Convidado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    desativado: { label: "Desativado", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? map.ativo;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function ConviteStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
    aceito: { label: "Aceito", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    expirado: { label: "Expirado", cls: "bg-muted text-muted-foreground border-border" },
    revogado: { label: "Revogado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const m = map[status] ?? map.pendente;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
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
  id: string; nome: string; email: string; status: string; ativo: boolean;
  ultimo_login: string | null; roles: string[]; empresas_count: number;
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
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-1"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="convites" className="gap-1"><Mail className="h-4 w-4" /> Convites</TabsTrigger>
          <TabsTrigger value="log" className="gap-1"><ClipboardList className="h-4 w-4" /> Log de auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-4"><UsuariosTab /></TabsContent>
        <TabsContent value="convites" className="mt-4"><ConvitesTab /></TabsContent>
        <TabsContent value="log" className="mt-4"><LogTab /></TabsContent>
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
  const users = (q.data ?? []) as UsuarioRow[];

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

  const [deactivating, setDeactivating] = useState<UsuarioRow | null>(null);
  const [reassigning, setReassigning] = useState<UsuarioRow | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [novoPapel, setNovoPapel] = useState<"admin" | "consultor">("consultor");

  const mStatus = useMutation({
    mutationFn: (v: { user_id: string; status: "ativo" | "desativado" }) => setStatusFn({ data: v }),
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
      setReassigning(null); setReassignTo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mPapel = useMutation({
    mutationFn: (v: { user_id: string; papel: "admin" | "consultor" }) => alterarPapelFn({ data: v }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin-log"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeConsultores = users.filter((u) => u.status === "ativo" && u.id !== reassigning?.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Buscar</Label>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="consultor">Consultor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Usuários ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? <p>Carregando…</p> : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum usuário encontrado com esses filtros.</p>
          ) : (
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
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="space-x-1">
                      {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                        : u.roles.map((r) => <RoleBadge key={r} role={r} />)}
                    </TableCell>
                    <TableCell><StatusBadge status={u.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString("pt-BR") : "—"}
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
                            if (!v && u.empresas_count > 0) setDeactivating(u);
                            else mStatus.mutate({ user_id: u.id, status: v ? "ativo" : "desativado" });
                          }}
                        />
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditing(u);
                          setNovoPapel((u.roles.includes("admin") ? "admin" : "consultor"));
                        }}>Editar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Desativação com carteira */}
      <AlertDialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {deactivating?.nome}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Este consultor é responsável por <strong>{deactivating?.empresas_count} cliente(s)</strong>.
                  Ao desativar:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Clientes e projetos <strong>permanecem no sistema</strong>.</li>
                  <li>Ficam <strong>sem consultor ativo</strong> até serem reatribuídos.</li>
                  <li>A sessão do usuário é <strong>encerrada imediatamente</strong>.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deactivating) {
                mStatus.mutate({ user_id: deactivating.id, status: "desativado" });
                setReassigning(deactivating); setDeactivating(null);
              }
            }}>Desativar e reatribuir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reatribuição */}
      <Dialog open={!!reassigning} onOpenChange={(o) => { if (!o) { setReassigning(null); setReassignTo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reatribuir carteira de {reassigning?.nome}</DialogTitle>
            <DialogDescription>
              Os <strong>{reassigning?.empresas_count} cliente(s)</strong> serão transferidos para outro consultor ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo consultor</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue placeholder="Selecione um consultor ativo" /></SelectTrigger>
              <SelectContent>
                {activeConsultores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome} ({u.empresas_count} clientes)</SelectItem>
                ))}
                {activeConsultores.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum outro consultor ativo.</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReassigning(null); setReassignTo(""); }}>Cancelar</Button>
            <Button disabled={!reassignTo || mReassign.isPending}
              onClick={() => {
                if (reassigning && reassignTo)
                  mReassign.mutate({ from_user_id: reassigning.id, to_user_id: reassignTo });
              }}>
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
              Altere o papel do usuário. Não é possível remover o papel admin do último administrador ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={novoPapel} onValueChange={(v: any) => setNovoPapel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="consultor">Consultor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={mPapel.isPending} onClick={() => {
              if (editing) mPapel.mutate({ user_id: editing.id, papel: novoPapel });
            }}>{mPapel.isPending ? "Salvando…" : "Salvar"}</Button>
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
  const reenviarFn = useServerFn(reenviarConvite);
  const revogarFn = useServerFn(revogarConvite);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-convites"], queryFn: () => listFn() });
  const convites = (q.data ?? []) as any[];

  const [openNovo, setOpenNovo] = useState(false);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"admin" | "consultor">("consultor");
  const [nome, setNome] = useState("");
  const [linkGerado, setLinkGerado] = useState<{ link: string; email: string } | null>(null);

  function buildLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/aceitar-convite?token=${encodeURIComponent(token)}`;
  }

  const mCriar = useMutation({
    mutationFn: () => criarFn({ data: { email, papel, nome: nome || undefined } }),
    onSuccess: (r: any) => {
      const link = buildLink(r.token);
      setLinkGerado({ link, email: r.convite.email_convidado });
      setEmail(""); setNome(""); setPapel("consultor"); setOpenNovo(false);
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
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function copyLink() {
    if (!linkGerado) return;
    await navigator.clipboard.writeText(linkGerado.link);
    toast.success("Link copiado");
  }

  const pendentes = convites.filter((c) => c.status === "pendente");
  const historico = convites.filter((c) => c.status !== "pendente");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpenNovo(true)} className="gap-1"><Plus className="h-4 w-4" /> Convidar usuário</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Convites pendentes ({pendentes.length})</CardTitle></CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum convite pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.email_convidado}</TableCell>
                    <TableCell><RoleBadge role={c.papel_designado} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.criado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.data_expiracao).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={mReenviar.isPending}
                          onClick={() => mReenviar.mutate(c.id)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          disabled={mRevogar.isPending} onClick={() => mRevogar.mutate(c.id)}>
                          <Ban className="h-3.5 w-3.5 mr-1" /> Revogar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {historico.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Histórico de convites</CardTitle></CardHeader>
          <CardContent>
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
                    <TableCell><RoleBadge role={c.papel_designado} /></TableCell>
                    <TableCell><ConviteStatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.criado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.aceito_em ? new Date(c.aceito_em).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Novo convite */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar novo usuário</DialogTitle>
            <DialogDescription>
              O convidado receberá um link único para definir a própria senha. O link expira em 7 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Nome (opcional)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={papel} onValueChange={(v: any) => setPapel(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultor">Consultor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNovo(false)}>Cancelar</Button>
            <Button disabled={!email || mCriar.isPending} onClick={() => mCriar.mutate()}>
              <Send className="h-4 w-4 mr-1" />
              {mCriar.isPending ? "Gerando…" : "Gerar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link gerado */}
      <Dialog open={!!linkGerado} onOpenChange={(o) => !o && setLinkGerado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convite pronto</DialogTitle>
            <DialogDescription>
              Envie este link para <strong>{linkGerado?.email}</strong>. O link é único e expira em 7 dias.
              Ele será invalidado automaticamente se o convite for reenviado ou revogado.
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
          <div className="flex items-end gap-2">
            <div>
              <Label>Filtrar por ação</Label>
              <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {Object.entries(ACAO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {q.isLoading ? <p>Carregando…</p> : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Executor</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.data_hora).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell><Badge variant="outline">{ACAO_LABEL[l.acao] ?? l.acao}</Badge></TableCell>
                    <TableCell className="text-sm">{l.executor_nome}</TableCell>
                    <TableCell className="text-sm">{l.afetado_nome ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[360px] truncate">
                      {JSON.stringify(l.detalhes_da_acao)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
