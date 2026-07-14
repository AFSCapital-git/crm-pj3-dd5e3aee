import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { upsertEmpresa, deleteEmpresa } from "@/lib/empresas.functions";
import { listUsuarios } from "@/lib/dashboard.functions";
import { listEmpresasPaginado } from "@/lib/pagination.functions";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";

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
    onSuccess: () => {
      toast.success("Empresa removida");
      qc.invalidateQueries({ queryKey: ["empresas-paginated"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  });
  return (
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
            onChange={(e) => setValues({ ...values, telefone: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>E-mail</Label>
        <Input
          type="email"
          value={values.email ?? ""}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
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
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
