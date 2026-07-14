import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listEmailsProjeto } from "@/lib/emails.functions";
import { INBOUND_EMAIL_ADDRESS } from "@/lib/inbound-email";

export function EmailsTab({ projetoId, codigoRastreio }: { projetoId: string; codigoRastreio: string }) {
  const listFn = useServerFn(listEmailsProjeto);
  const q = useQuery({
    queryKey: ["emails-projeto", projetoId],
    queryFn: () => listFn({ data: { projeto_id: projetoId } }),
  });

  const instrucao = `Para vincular um e-mail a este projeto, encaminhe para ${INBOUND_EMAIL_ADDRESS} incluindo ${codigoRastreio} no assunto.`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Código de rastreio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <code className="text-lg font-mono px-3 py-1.5 rounded bg-muted">{codigoRastreio}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(codigoRastreio); toast.success("Código copiado"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar código
            </Button>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(INBOUND_EMAIL_ADDRESS); toast.success("Endereço copiado"); }}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar endereço
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{instrucao}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">E-mails vinculados ({q.data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum e-mail encaminhado ainda.</p>
          )}
          <div className="divide-y">
            {q.data?.map((e: any) => (
              <div key={e.id} className="py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{e.remetente_original}</span>
                  <span>·</span>
                  <span>{e.data_email_original ? new Date(e.data_email_original).toLocaleString("pt-BR") : new Date(e.criado_em).toLocaleString("pt-BR")}</span>
                  {Array.isArray(e.anexos_referenciados) && e.anexos_referenciados.length > 0 && (
                    <Badge variant="outline" className="ml-1">{e.anexos_referenciados.length} anexo(s)</Badge>
                  )}
                </div>
                <p className="font-medium mt-1">{e.assunto || "(sem assunto)"}</p>
                {e.corpo_texto && (
                  <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-6">{e.corpo_texto}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
