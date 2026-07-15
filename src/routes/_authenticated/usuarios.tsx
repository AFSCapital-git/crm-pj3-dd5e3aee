import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listUsuarios,
  setUsuarioAtivo,
  reassignEmpresasConsultor,
} from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, UserCog, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  roles: string[];
  empresas_count: number;
};

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

function UsuariosPage() {
  const listFn = useServerFn(listUsuarios);
  const setAtivoFn = useServerFn(setUsuarioAtivo);
  const reassignFn = useServerFn(reassignEmpresasConsultor);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["usuarios-full"], queryFn: () => listFn() });

  const users = (q.data ?? []) as UsuarioRow[];

  const [deactivating, setDeactivating] = useState<UsuarioRow | null>(null);
  const [reassigning, setReassigning] = useState<UsuarioRow | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

  const mAtivo = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => setAtivoFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.ativo ? "Usuário ativado" : "Usuário desativado");
      qc.invalidateQueries({ queryKey: ["usuarios-full"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mReassign = useMutation({
    mutationFn: (v: { from_user_id: string; to_user_id: string }) =>
      reassignFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`${r.count} cliente(s) reatribuído(s)`);
      qc.invalidateQueries({ queryKey: ["usuarios-full"] });
      setReassigning(null);
      setReassignTo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeConsultores = users.filter(
    (u) => u.ativo && u.id !== reassigning?.id,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários internos</h1>
        <p className="text-sm text-muted-foreground">
          Consultores e administradores. Novos usuários são criados via cadastro em /auth.
          Papéis são ajustados no backend na tabela user_roles.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Carteira</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="space-x-1">
                      {u.roles.length === 0
                        ? <span className="text-muted-foreground text-sm">—</span>
                        : u.roles.map((r) => <RoleBadge key={r} role={r} />)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.empresas_count}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.ativo}
                          disabled={mAtivo.isPending}
                          onCheckedChange={(v) => {
                            if (!v && u.empresas_count > 0) {
                              setDeactivating(u);
                            } else {
                              mAtivo.mutate({ id: u.id, ativo: v });
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.empresas_count > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setReassigning(u); setReassignTo(""); }}
                        >
                          Reatribuir carteira
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {deactivating?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este consultor é responsável por <strong>{deactivating?.empresas_count}
              {" "}cliente(s)</strong> e seus projetos. Ao desativar:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Os clientes e projetos <strong>permanecem no sistema</strong> — nada é excluído.</li>
                <li>Eles ficam <strong>sem consultor ativo</strong> até serem reatribuídos.</li>
                <li>O usuário não consegue mais fazer login nem acessar sua carteira.</li>
              </ul>
              <p className="mt-2">
                Recomendamos <strong>reatribuir a carteira antes</strong> de desativar.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivating) {
                  mAtivo.mutate({ id: deactivating.id, ativo: false });
                  setReassigning(deactivating);
                  setDeactivating(null);
                }
              }}
            >
              Desativar e reatribuir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!reassigning}
        onOpenChange={(o) => { if (!o) { setReassigning(null); setReassignTo(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reatribuir carteira de {reassigning?.nome}</DialogTitle>
            <DialogDescription>
              Todos os <strong>{reassigning?.empresas_count} cliente(s)</strong> sob responsabilidade
              deste usuário serão transferidos para outro consultor ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo consultor responsável</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue placeholder="Selecione um consultor ativo" /></SelectTrigger>
              <SelectContent>
                {activeConsultores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} ({u.empresas_count} clientes)
                  </SelectItem>
                ))}
                {activeConsultores.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum outro consultor ativo disponível.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReassigning(null); setReassignTo(""); }}>
              Cancelar
            </Button>
            <Button
              disabled={!reassignTo || mReassign.isPending}
              onClick={() => {
                if (reassigning && reassignTo) {
                  mReassign.mutate({
                    from_user_id: reassigning.id,
                    to_user_id: reassignTo,
                  });
                }
              }}
            >
              {mReassign.isPending ? "Reatribuindo…" : "Confirmar reatribuição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
