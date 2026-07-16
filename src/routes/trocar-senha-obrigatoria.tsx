import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/trocar-senha-obrigatoria")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: TrocarSenhaObrigatoria,
});

function TrocarSenhaObrigatoria() {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (novaSenha.length < 8) {
      return toast.error("Senha deve ter no mínimo 8 caracteres");
    }

    if (novaSenha !== confirmacao) {
      return toast.error("As senhas não coincidem");
    }

    setLoading(true);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setLoading(false);
      return toast.error("Erro ao obter dados do usuário");
    }

    const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
    if (authError) {
      setLoading(false);
      return toast.error(authError.message);
    }

    const { error: dbError } = await supabase
      .from("usuarios_internos")
      .update({ senha_temporaria: false })
      .eq("id", user.user.id);

    setLoading(false);

    if (dbError) {
      console.error("Erro ao marcar senha como permanente:", dbError);
      return toast.error("Erro ao atualizar perfil");
    }

    toast.success("Senha alterada com sucesso!");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Trocar senha</CardTitle>
          <CardDescription>
            Defina uma nova senha para sua conta GestorFINEP. Isso é obrigatório no primeiro acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <Label htmlFor="confirmacao">Confirmar senha</Label>
              <Input
                id="confirmacao"
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                required
                minLength={8}
                placeholder="Confirme a senha"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
