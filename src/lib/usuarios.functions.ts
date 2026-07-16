import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("usuarios_internos")
      .select("id,nome,email")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });

export const deactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("deactivate_user", {
      _user_id: data.userId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });

export const reactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reactivate_user", {
      _user_id: data.userId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });
