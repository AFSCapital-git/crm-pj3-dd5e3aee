import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsuarios } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const fn = useServerFn(listUsuarios);
  const q = useQuery({ queryKey: ["usuarios-full"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários internos</h1>
        <p className="text-sm text-muted-foreground">
          Consultores e administradores da consultoria. Novos usuários são criados via tela de cadastro em /auth.
          O primeiro usuário criado vira admin; os demais entram como consultor. Papéis podem ser ajustados diretamente na tabela user_roles no backend.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(q.data ?? []).map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="space-x-1">
                      {u.roles.map((r: string) => <Badge key={r} variant="outline">{r}</Badge>)}
                      {u.roles.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell>{u.ativo ? "Sim" : "Não"}</TableCell>
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
