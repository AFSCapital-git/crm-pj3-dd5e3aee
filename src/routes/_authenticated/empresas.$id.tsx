import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEmpresa } from "@/lib/empresas.functions";
import { DocumentosTab } from "@/components/documentos-tab";

export const Route = createFileRoute("/_authenticated/empresas/$id")({
  component: EmpresaDetailPage,
});

function EmpresaDetailPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getEmpresa);
  const q = useQuery({
    queryKey: ["empresa", id],
    queryFn: () => get({ data: { id } }),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const e: any = q.data as any;
  if (!e) return <p className="text-sm text-muted-foreground">Empresa não encontrada.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild size="icon" variant="ghost">
          <Link to="/empresas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{e.razao_social}</h1>
          <p className="text-sm text-muted-foreground">
            {e.cnpj} · {e.porte} ·{" "}
            <Badge variant="outline" className="ml-1">
              {e.status}
            </Badge>
          </p>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
              <Info label="Setor" value={e.setor_atuacao} />
              <Info label="Contato" value={e.contato_responsavel} />
              <Info label="E-mail" value={e.email} />
              <Info label="Telefone" value={e.telefone} />
              <Info label="Consultor responsável" value={e.consultor?.nome ?? "—"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentosTab empresaId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}
