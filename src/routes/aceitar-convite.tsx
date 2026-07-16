import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { validarConvite, aceitarConvite } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MailCheck } from "lucide-react";

type Search = { token?: string };

export const Route = createFileRoute("/aceitar-convite")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const validar = useServerFn(validarConvite);
  const aceitar = useServerFn(aceitarConvite);

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid"; motivo: string }
    | {
        kind: "form";
        email: string;
        papel: string;
        nome_sugerido: string | null;
        expira_em: string;
      }
    | { kind: "done"; email: string }
  >({ kind: "loading" });

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", motivo: "Link inválido: token ausente." });
      return;
    }
    validar({ data: { token } })
      .then((r) => {
        if (!r.valid) setState({ kind: "invalid", motivo: r.motivo });
        else {
          setState({
            kind: "form",
            email: r.email,
            papel: r.papel,
            nome_sugerido: r.nome_sugerido ?? null,
            expira_em: r.expira_em,
          });
          if (r.nome_sugerido) setNome(r.nome_sugerido);
        }
      })
      .catch((e) => setState({ kind: "invalid", motivo: e.message ?? "Erro ao validar convite." }));
  }, [token, validar]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== senha2) return toast.error("As senhas não conferem.");
    if (senha.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres.");
    if (nome.trim().length < 2) return toast.error("Informe seu nome.");
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await aceitar({ data: { token, nome: nome.trim(), senha } });
      setState({ kind: "done", email: r.email });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao aceitar convite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">GestorFINEP</CardTitle>
          <CardDescription>Aceite de convite</CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === "loading" && (
            <p className="text-center text-sm text-muted-foreground py-6">Validando convite…</p>
          )}
          {state.kind === "invalid" && (
            <div className="text-center py-6 space-y-3">
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
              <p className="font-medium">Convite não pode ser usado</p>
              <p className="text-sm text-muted-foreground">{state.motivo}</p>
              <p className="text-xs text-muted-foreground">
                Peça a um administrador para reenviar o convite.
              </p>
            </div>
          )}
          {state.kind === "done" && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <p className="font-medium">Cadastro concluído!</p>
              <p className="text-sm text-muted-foreground">
                Sua conta foi criada com o e-mail <strong>{state.email}</strong>. Faça login para
                continuar.
              </p>
              <Button asChild className="w-full mt-2">
                <a href="/auth">Ir para login</a>
              </Button>
            </div>
          )}
          {state.kind === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <MailCheck className="h-4 w-4 text-primary" />
                  <span>
                    Convidando <strong>{state.email}</strong>
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Papel: <strong className="uppercase">{state.papel}</strong> · válido até{" "}
                  {new Date(state.expira_em).toLocaleString("pt-BR")}
                </div>
              </div>
              <div>
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="senha">Defina sua senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo 8 caracteres. Evite senhas comuns.
                </p>
              </div>
              <div>
                <Label htmlFor="senha2">Confirme a senha</Label>
                <Input
                  id="senha2"
                  type="password"
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Concluindo…" : "Aceitar convite e criar conta"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
