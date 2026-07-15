import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listUsuarios } from "@/lib/dashboard.functions";
import { deactivateUser, reactivateUser } from "@/lib/usuarios.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const fn = useServerFn(listUsuarios);
  const deactivate = useServerFn(deactivateUser);
  const reactivate = useServerFn(reactivateUser);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["usuarios-full"], queryFn: () => fn() });

  const mDeactivate = useMutation({
    mutationFn: (userId: string) => deactivate({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário desativado");
      qc.invalidateQueries({ queryKey: ["usuarios-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mReactivate = useMutation({
    mutationFn: (userId: string) => reactivate({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário reativado");
      qc.invalidateQueries({ queryKey: ["usuarios-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários internos</h1>
        <p className="text-sm text-muted-foreground">
          Consultores e administradores da consultoria. Novos usuários são criados via tela de
          cadastro em /auth. O primeiro usuário criado vira admin; os demais entram como consultor.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p>Carregando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((u: Record<string, unknown>) => {
                  const isInactive = !(u.ativo as boolean);
                  return (
                    <TableRow key={u.id as string} className={isInactive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{u.nome as string}</TableCell>
                      <TableCell>{u.email as string}</TableCell>
                      <TableCell className="space-x-1">
                        {((u.roles as Array<string>) ?? []).map((r: string) => (
                          <Badge key={r} variant="outline">
                            {r}
                          </Badge>
                        ))}
                        {((u.roles as Array<string>) ?? []).length === 0 && (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isInactive ? "destructive" : "outline"}>
                          {isInactive ? "Inativo" : "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        {isInactive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => mReactivate.mutate(u.id as string)}
                            disabled={mReactivate.isPending}
                          >
                            Reativar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  `Desativar ${u.nome}? Isso bloqueará o acesso imediatamente.`,
                                )
                              ) {
                                mDeactivate.mutate(u.id as string);
                              }
                            }}
                            disabled={mDeactivate.isPending}
                          >
                            Desativar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
