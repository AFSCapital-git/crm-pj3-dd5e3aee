import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("usuarios_internos").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const role = roles?.find((r) => r.role === "admin") ? "admin"
      : roles?.[0]?.role ?? null;
    return {
      id: userId,
      nome: profile?.nome ?? "",
      email: profile?.email ?? "",
      ativo: profile?.ativo ?? true,
      role: role as "admin" | "consultor" | null,
    };
  });
