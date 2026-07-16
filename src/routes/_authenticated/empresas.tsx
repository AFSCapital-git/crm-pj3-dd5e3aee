import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, FileText, Loader2, Search, X, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listEmpresas, listEmpresasInativas, upsertEmpresa, deleteEmpresa, reactivateEmpresa } from "@/lib/empresas.functions";
import { listUsuarios } from "@/lib/dashboard.functions";
import {
  formatCpfCnpj,
  formatTelefone,
  validateCpfCnpj,
  validateEmail,
  validateTelefone,
  onlyDigits,
} from "@/lib/validators";

export const Route = createFileRoute("/_authenticated/empresas")({
  component: EmpresasPage,
});

function EmpresasPage() {
  const list = useServerFn(listEmpresas);
  const listInativas = useServerFn(listEmpresasInativas);
  const usuarios = useServerFn(listUsuarios);
  const q = useQuery({ queryKey: ["empresas"], queryFn: () => list() });
  const qInativas = useQuery({ queryKey: ["empresas-inativas"], queryFn: () => listInativas() });
  const qUsers = useQuery({ queryKey: ["usuarios"], queryFn: () => usuarios() });
  const qc = useQueryClient();

  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [tab, setTab] = useState<"ativas" | "inativas">("ativas");

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [porteFilter, setPorteFilter] = useState<string>("all");
  const hasFilters = search.trim() !== "" || statusFilter !== "all" || porteFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPorteFilter("all");
  };

  const upsert = useServerFn(upsertEmpresa);
  const del = useServerFn(deleteEmpresa);
  const reactivate = useServerFn(reactivateEmpresa);

  const mUpsert = useMutation({
    mutationFn: (input: any) => upsert({ data: input }),
    onSuccess: () => {
      toast.success("Empresa salva");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Empresa removida");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["empresas-inativas"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mReactivate = useMutation({
    mutationFn: (id: string) => reactivate({ data: { id } }),
    onSuccess: () => {
      toast.success("Empresa reativada");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["empresas-inativas"] });
    },
    onError: (e: any) => toast.error(e.message),
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
              onSubmit={(values: any) => mUpsert.mutate({ id: editing?.id, values })}
              loading={mUpsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "ativas" | "inativas")}>
            <TabsList>
              <TabsTrigger value="ativas">Ativas</TabsTrigger>
              <TabsTrigger value="inativas">Inativas</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>{tab === "ativas" ? "Empresas ativas" : "Empresas inativas"}</CardTitle>
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
                <SelectTrigger className="sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={porteFilter} onValueChange={setPorteFilter}>
                <SelectTrigger className="sm:w-32">
                  <SelectValue placeholder="Porte" />
                </SelectTrigger>
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
          {tab === "ativas" ? (
            <>
              {q.isLoading ? (
                <p>Carregando…</p>
              ) : (
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
                        <TableCell>
                          <Badge variant="outline">{e.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button asChild size="icon" variant="ghost" title="Abrir">
                            <Link to="/empresas/$id" params={{ id: e.id }}>
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
              )}
            </>
          ) : (
            <>
              {qInativas.isLoading ? (
                <p>Carregando…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razão social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Porte</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(qInativas.data ?? []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.razao_social}</TableCell>
                        <TableCell>{e.cnpj}</TableCell>
                        <TableCell>{e.porte}</TableCell>
                        <TableCell>{e.consultor?.nome ?? "—"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Reativar"
                            disabled={mReactivate.isPending}
                            onClick={() => mReactivate.mutate(e.id)}
                          >
                            {mReactivate.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(qInativas.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          Nenhuma empresa inativa.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Você vai remover <strong>{toDelete?.razao_social}</strong> da lista ativa de clientes.
              O histórico associado (projetos, interações, documentos e e-mails vinculados)
              permanece preservado no sistema para fins de auditoria e não será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mDelete.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mDelete.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) mDelete.mutate(toDelete.id);
              }}
            >
              {mDelete.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removendo…
                </>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
    cep: initial?.cep ?? "",
    rua: initial?.rua ?? "",
    numero: initial?.numero ?? "",
    complemento: initial?.complemento ?? "",
    bairro: initial?.bairro ?? "",
    cidade: initial?.cidade ?? "",
    estado: initial?.estado ?? "",
  });
  const [cepLoading, setCepLoading] = useState(false);
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
      cep: values.cep ? onlyDigits(values.cep) : null,
    });
  };

  const fieldErrorProps = (name: "cnpj" | "email" | "telefone") => ({
    "aria-invalid": !!errors[name] || undefined,
    className: errors[name] ? "border-destructive focus-visible:ring-destructive" : "",
  });

  const buscarCEP = async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();

      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }

      setValues((prev) => ({
        ...prev,
        rua: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
      }));
    } catch (err) {
      toast.error("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
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
        </div>
        <div>
          <Label>Porte</Label>
          <Select
            value={values.porte}
            onValueChange={(v) => setValues({ ...values, porte: v as any })}
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
        <div>
          <Label>Telefone</Label>
          <Input
            value={values.telefone ?? ""}
            onChange={(e) => handleChange("telefone", e.target.value)}
            onBlur={() => handleBlur("telefone")}
            placeholder="(11) 99999-9999"
            {...fieldErrorProps("telefone")}
          />
          {errors.telefone && <p className="mt-1 text-xs text-destructive">{errors.telefone}</p>}
        </div>
      </div>
      <div>
        <Label>E-mail</Label>
        <Input
          type="email"
          value={values.email ?? ""}
          onChange={(e) => handleChange("email", e.target.value)}
          onBlur={() => handleBlur("email")}
          {...fieldErrorProps("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
      </div>

      <div className="border-t pt-3">
        <h3 className="font-semibold text-sm mb-3">Endereço</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CEP</Label>
          <Input
            value={values.cep ?? ""}
            onChange={(e) => setValues({ ...values, cep: e.target.value })}
            onBlur={() => buscarCEP(values.cep ?? "")}
            placeholder="00000-000"
            disabled={cepLoading}
          />
        </div>
        <div />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label>Rua</Label>
          <Input
            value={values.rua ?? ""}
            onChange={(e) => setValues({ ...values, rua: e.target.value })}
            placeholder="Nome da rua"
          />
        </div>
        <div>
          <Label>Número</Label>
          <Input
            value={values.numero ?? ""}
            onChange={(e) => setValues({ ...values, numero: e.target.value })}
            placeholder="Nº"
          />
        </div>
      </div>

      <div>
        <Label>Complemento</Label>
        <Input
          value={values.complemento ?? ""}
          onChange={(e) => setValues({ ...values, complemento: e.target.value })}
          placeholder="Apto, sala, etc (opcional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Bairro</Label>
          <Input
            value={values.bairro ?? ""}
            onChange={(e) => setValues({ ...values, bairro: e.target.value })}
            placeholder="Bairro"
          />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input
            value={values.cidade ?? ""}
            onChange={(e) => setValues({ ...values, cidade: e.target.value })}
            placeholder="Cidade"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Estado (UF)</Label>
          <Input
            value={values.estado ?? ""}
            onChange={(e) => setValues({ ...values, estado: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="SP"
            maxLength={2}
          />
        </div>
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
              {usuarios.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={values.status}
            onValueChange={(v) => setValues({ ...values, status: v as any })}
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
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
