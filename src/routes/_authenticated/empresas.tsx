import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
<<<<<<< HEAD
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, ChevronDown } from "lucide-react";
=======
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, Loader2, Search, X } from "lucide-react";
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
import { Link } from "@tanstack/react-router";
import { upsertEmpresa, deleteEmpresa } from "@/lib/empresas.functions";
import { listUsuarios } from "@/lib/dashboard.functions";
<<<<<<< HEAD
import { listEmpresasPaginado } from "@/lib/pagination.functions";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
=======
import {
  formatCpfCnpj,
  formatTelefone,
  validateCpfCnpj,
  validateEmail,
  validateTelefone,
  onlyDigits,
} from "@/lib/validators";
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de

export const Route = createFileRoute("/_authenticated/empresas")({
  component: EmpresasPage,
});

function EmpresasPage() {
  const listFn = useServerFn(listEmpresasPaginado);
  const usuarios = useServerFn(listUsuarios);
  const { items, loadMore, hasMore, isLoadingMore, isLoading, error } = usePaginatedQuery(
    ["empresas-paginated"],
    (cursor) => listFn({ data: { cursor, pageSize: 50 } }),
  );
  const qUsers = useQuery({ queryKey: ["usuarios"], queryFn: () => usuarios() });
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [porteFilter, setPorteFilter] = useState<string>("all");
  const hasFilters = search.trim() !== "" || statusFilter !== "all" || porteFilter !== "all";
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setPorteFilter("all"); };

  const upsert = useServerFn(upsertEmpresa);
  const del = useServerFn(deleteEmpresa);

  const mUpsert = useMutation({
    mutationFn: (input: Record<string, unknown>) => upsert({ data: input }),
    onSuccess: () => {
      toast.success("Empresa salva");
      qc.invalidateQueries({ queryKey: ["empresas-paginated"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
<<<<<<< HEAD
    onSuccess: () => {
      toast.success("Empresa removida");
      qc.invalidateQueries({ queryKey: ["empresas-paginated"] });
    },
    onError: (e: Error) => toast.error(e.message),
=======
    onSuccess: () => { toast.success("Empresa removida"); qc.invalidateQueries({ queryKey: ["empresas"] }); setToDelete(null); },
    onError: (e: any) => toast.error(e.message),
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
  });

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    const s = search.trim().toLowerCase();
    const sDigits = onlyDigits(search);
    return rows.filter((e: any) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (porteFilter !== "all" && e.porte !== porteFilter) return false;
      if (!s) return true;
      const nome = (e.razao_social ?? "").toLowerCase();
      const cnpj = onlyDigits(e.cnpj ?? "");
      return nome.includes(s) || (sDigits && cnpj.includes(sDigits));
    });
  }, [q.data, search, statusFilter, porteFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas clientes</h1>
          <p className="text-sm text-muted-foreground">
            Carteira de empresas atendidas pela consultoria.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> Nova empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            </DialogHeader>
            <EmpresaForm
              initial={editing}
              usuarios={qUsers.data ?? []}
              onSubmit={(values: Record<string, unknown>) =>
                mUpsert.mutate({ id: editing?.id, values })
              }
              loading={mUpsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
<<<<<<< HEAD
          <CardTitle>
            Lista{" "}
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
                    <TableHead>Razão social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Porte</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e: Record<string, unknown>) => (
                    <TableRow key={e.id as string}>
                      <TableCell className="font-medium">{e.razao_social}</TableCell>
                      <TableCell>{e.cnpj}</TableCell>
                      <TableCell>{e.porte}</TableCell>
                      <TableCell>{e.consultor?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button asChild size="icon" variant="ghost" title="Abrir">
                          <Link to="/empresas/$id" params={{ id: e.id as string }}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
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
                          onClick={() => confirm("Remover empresa?") && mDelete.mutate(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma empresa cadastrada.
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
=======
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Lista</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 sm:w-64"
                  placeholder="Buscar por nome ou CNPJ…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={porteFilter} onValueChange={setPorteFilter}>
                <SelectTrigger className="sm:w-32"><SelectValue placeholder="Porte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os portes</SelectItem>
                  <SelectItem value="ME">ME</SelectItem>
                  <SelectItem value="EPP">EPP</SelectItem>
                  <SelectItem value="Grande">Grande</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
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
                {filtered.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.razao_social}</TableCell>
                    <TableCell>{e.cnpj}</TableCell>
                    <TableCell>{e.porte}</TableCell>
                    <TableCell>{e.consultor?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button asChild size="icon" variant="ghost" title="Abrir">
                        <Link to="/empresas/$id" params={{ id: e.id }}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setToDelete(e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      {(q.data ?? []).length === 0 ? (
                        "Nenhuma empresa cadastrada."
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span>Nenhum cliente encontrado com esses filtros.</span>
                          <Button variant="outline" size="sm" onClick={clearFilters}>
                            <X className="mr-1 h-4 w-4" /> Limpar filtros
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Você vai remover <strong>{toDelete?.razao_social}</strong> da lista ativa de clientes.
              O histórico associado (projetos, interações, documentos e e-mails vinculados) permanece
              preservado no sistema para fins de auditoria e não será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mDelete.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mDelete.isPending}
              onClick={(e) => { e.preventDefault(); if (toDelete) mDelete.mutate(toDelete.id); }}
            >
              {mDelete.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removendo…</>) : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

<<<<<<< HEAD
function EmpresaForm({
  initial,
  usuarios,
  onSubmit,
  loading,
}: {
  initial: Record<string, unknown> | null;
  usuarios: Record<string, unknown>[];
  onSubmit: (values: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [values, setValues] = useState({
    razao_social: (initial?.razao_social as string) ?? "",
    cnpj: (initial?.cnpj as string) ?? "",
    porte: (initial?.porte as string) ?? "ME",
    setor_atuacao: (initial?.setor_atuacao as string) ?? "",
    contato_responsavel: (initial?.contato_responsavel as string) ?? "",
    email: (initial?.email as string) ?? "",
    telefone: (initial?.telefone as string) ?? "",
    consultor_responsavel_id: (initial?.consultor_responsavel_id as string | null) ?? null,
    status: (initial?.status as string) ?? "lead",
=======
type Errors = Partial<Record<"cnpj" | "email" | "telefone", string>>;

function EmpresaForm({ initial, usuarios, onSubmit, loading }: any) {
  const [values, setValues] = useState({
    razao_social: initial?.razao_social ?? "",
    cnpj: initial?.cnpj ? formatCpfCnpj(initial.cnpj) : "",
    porte: initial?.porte ?? "ME",
    setor_atuacao: initial?.setor_atuacao ?? "",
    contato_responsavel: initial?.contato_responsavel ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ? formatTelefone(initial.telefone) : "",
    consultor_responsavel_id: initial?.consultor_responsavel_id ?? null,
    status: initial?.status ?? "lead",
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
  });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: "cnpj" | "email" | "telefone", raw: string): string | null => {
    if (name === "cnpj") return validateCpfCnpj(raw);
    if (name === "email") return validateEmail(raw, false);
    if (name === "telefone") return validateTelefone(raw, false);
    return null;
  };

  const handleBlur = (name: "cnpj" | "email" | "telefone") => {
    setTouched((t) => ({ ...t, [name]: true }));
    const err = validateField(name, (values as any)[name] ?? "");
    setErrors((e) => ({ ...e, [name]: err ?? undefined }));
  };

  const handleChange = (name: "cnpj" | "email" | "telefone", v: string) => {
    let next = v;
    if (name === "cnpj") next = formatCpfCnpj(v);
    if (name === "telefone") next = formatTelefone(v);
    setValues((s) => ({ ...s, [name]: next }));
    if (touched[name]) {
      const err = validateField(name, next);
      setErrors((e) => ({ ...e, [name]: err ?? undefined }));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Errors = {
      cnpj: validateCpfCnpj(values.cnpj) ?? undefined,
      email: validateEmail(values.email, false) ?? undefined,
      telefone: validateTelefone(values.telefone, false) ?? undefined,
    };
    setTouched({ cnpj: true, email: true, telefone: true });
    setErrors(newErrors);
    if (newErrors.cnpj || newErrors.email || newErrors.telefone) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    if (loading) return;
    onSubmit({
      ...values,
      cnpj: onlyDigits(values.cnpj),
      telefone: values.telefone ? onlyDigits(values.telefone) : null,
      email: values.email || null,
    });
  };

  const fieldErrorProps = (name: "cnpj" | "email" | "telefone") => ({
    "aria-invalid": !!errors[name] || undefined,
    className: errors[name] ? "border-destructive focus-visible:ring-destructive" : "",
  });

  return (
<<<<<<< HEAD
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-3"
    >
      <div>
        <Label>Razão social</Label>
        <Input
          value={values.razao_social}
          onChange={(e) => setValues({ ...values, razao_social: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CNPJ</Label>
          <Input
            value={values.cnpj}
            onChange={(e) => setValues({ ...values, cnpj: e.target.value })}
            required
          />
=======
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Razão social</Label>
        <Input value={values.razao_social} onChange={(e) => setValues({ ...values, razao_social: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CPF / CNPJ</Label>
          <Input
            value={values.cnpj}
            onChange={(e) => handleChange("cnpj", e.target.value)}
            onBlur={() => handleBlur("cnpj")}
            placeholder="00.000.000/0000-00"
            required
            {...fieldErrorProps("cnpj")}
          />
          {errors.cnpj && <p className="mt-1 text-xs text-destructive">{errors.cnpj}</p>}
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
        </div>
        <div>
          <Label>Porte</Label>
          <Select
            value={values.porte}
            onValueChange={(v: string) => setValues({ ...values, porte: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ME">ME</SelectItem>
              <SelectItem value="EPP">EPP</SelectItem>
              <SelectItem value="Grande">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
<<<<<<< HEAD
      <div>
        <Label>Setor de atuação</Label>
        <Input
          value={values.setor_atuacao ?? ""}
          onChange={(e) => setValues({ ...values, setor_atuacao: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Contato</Label>
          <Input
            value={values.contato_responsavel ?? ""}
            onChange={(e) => setValues({ ...values, contato_responsavel: e.target.value })}
          />
        </div>
=======
      <div><Label>Setor de atuação</Label><Input value={values.setor_atuacao ?? ""} onChange={(e) => setValues({ ...values, setor_atuacao: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Contato</Label><Input value={values.contato_responsavel ?? ""} onChange={(e) => setValues({ ...values, contato_responsavel: e.target.value })} /></div>
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
        <div>
          <Label>Telefone</Label>
          <Input
            value={values.telefone ?? ""}
<<<<<<< HEAD
            onChange={(e) => setValues({ ...values, telefone: e.target.value })}
          />
=======
            onChange={(e) => handleChange("telefone", e.target.value)}
            onBlur={() => handleBlur("telefone")}
            placeholder="(11) 99999-9999"
            {...fieldErrorProps("telefone")}
          />
          {errors.telefone && <p className="mt-1 text-xs text-destructive">{errors.telefone}</p>}
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
        </div>
      </div>
      <div>
        <Label>E-mail</Label>
        <Input
          type="email"
          value={values.email ?? ""}
<<<<<<< HEAD
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
=======
          onChange={(e) => handleChange("email", e.target.value)}
          onBlur={() => handleBlur("email")}
          {...fieldErrorProps("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Consultor responsável</Label>
          <Select
            value={values.consultor_responsavel_id ?? "none"}
            onValueChange={(v) =>
              setValues({ ...values, consultor_responsavel_id: v === "none" ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— sem responsável —</SelectItem>
              {usuarios.map((u: Record<string, unknown>) => (
                <SelectItem key={u.id as string} value={u.id as string}>
                  {u.nome as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={values.status}
            onValueChange={(v: string) => setValues({ ...values, status: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
<<<<<<< HEAD
          Salvar
=======
          {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</>) : "Salvar"}
>>>>>>> 1b78db33cd458632241ee46c1aee77bd182e17de
        </Button>
      </DialogFooter>
    </form>
  );
}
