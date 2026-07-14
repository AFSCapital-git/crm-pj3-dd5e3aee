import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/auth.functions";
import { AiInsightsPanel } from "@/components/ai-insights-panel";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const fetchMe = useServerFn(getCurrentUser);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const isAdmin = me.data?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assistente de Portfólio</h1>
        <p className="text-sm text-muted-foreground">
          Análises, alertas e sugestões geradas por IA sobre o portfólio de projetos ativos.
          Nenhuma sugestão vira ação sem aprovação humana explícita.
        </p>
      </div>
      <AiInsightsPanel isAdmin={isAdmin} />
    </div>
  );
}
