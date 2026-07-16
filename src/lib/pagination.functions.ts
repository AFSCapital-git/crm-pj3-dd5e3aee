import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Schema de paginação cursor-based
const paginationSchema = z.object({
  cursor: z.string().uuid().nullable().optional(), // ID do último item da página anterior
  pageSize: z.number().int().min(10).max(100).default(50),
});

// ============================================================
// Paginação de Empresas
// ============================================================
export const listEmpresasPaginado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paginationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { cursor, pageSize } = data;

    // Query base: empresas com consultor (para ordenação)
    let query = context.supabase
      .from("empresas_clientes")
      .select(
        "id,razao_social,cnpj,porte,status,consultor:consultor_responsavel_id(id,nome,email),created_at",
      );

    // Cursor: busca o próximo item após o cursor (se fornecido)
    if (cursor) {
      const { data: cursorRow } = await context.supabase
        .from("empresas_clientes")
        .select("created_at")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        // Usar created_at para ordenação, depois ID para tiebreak
        query = query.or(
          `created_at.lt.${new Date(cursorRow.created_at).toISOString()},and(created_at.eq.${new Date(cursorRow.created_at).toISOString()},id.lt.${cursor})`,
        );
      }
    }

    // Buscar pageSize + 1 para saber se há mais
    const { data: rows, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (error) throw error;

    const hasMore = (rows?.length ?? 0) > pageSize;
    const items = ((rows ?? []) as any[]).slice(0, pageSize);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return {
      items,
      nextCursor,
      hasMore,
      pageSize,
    };
  });

// ============================================================
// Paginação de Editais
// ============================================================
export const listEditaisPaginado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paginationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { cursor, pageSize } = data;

    let query = context.supabase
      .from("linhas_editais_finep")
      .select("id,nome,categoria,orgao,prazo_submissao,ativo,created_at");

    if (cursor) {
      const { data: cursorRow } = await context.supabase
        .from("linhas_editais_finep")
        .select("prazo_submissao,created_at")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        // Ordenar por data do prazo (null last), depois created_at
        const prazo = cursorRow.prazo_submissao;
        const created = new Date(cursorRow.created_at).toISOString();

        if (prazo) {
          query = query.or(
            `prazo_submissao.gt.${prazo},and(prazo_submissao.eq.${prazo},created_at.lt.${created})`,
          );
        } else {
          // Se cursor tem prazo = null, pega itens com prazo != null OU (prazo = null E criado < cursor)
          query = query.or(
            `prazo_submissao.not.is.null,and(prazo_submissao.is.null,created_at.lt.${created})`,
          );
        }
      }
    }

    const { data: rows, error } = await query
      .order("prazo_submissao", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(pageSize + 1);

    if (error) throw error;

    const hasMore = (rows?.length ?? 0) > pageSize;
    const items = ((rows ?? []) as any[]).slice(0, pageSize);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return {
      items,
      nextCursor,
      hasMore,
      pageSize,
    };
  });

// ============================================================
// Paginação de Marcos
// ============================================================
export const listMarcosPaginado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paginationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { cursor, pageSize } = data;

    let query = context.supabase
      .from("marcos_com_urgencia")
      .select(
        "id,projeto_id,tipo,data_prevista,status,urgencia,nome_projeto,empresa_razao_social,dias_para_vencer,created_at",
      );

    if (cursor) {
      const { data: cursorRow } = await context.supabase
        .from("marcos_com_urgencia")
        .select("data_prevista,created_at")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        const dataPrevista = cursorRow.data_prevista;
        const created = cursorRow.created_at
          ? new Date(cursorRow.created_at).toISOString()
          : new Date().toISOString();

        if (dataPrevista) {
          query = query.or(
            `data_prevista.gt.${dataPrevista},and(data_prevista.eq.${dataPrevista},created_at.lt.${created})`,
          );
        }
      }
    }

    const { data: rows, error } = await query
      .order("data_prevista", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(pageSize + 1);

    if (error) throw error;

    const hasMore = (rows?.length ?? 0) > pageSize;
    const items = (rows ?? []).slice(0, pageSize);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return {
      items,
      nextCursor,
      hasMore,
      pageSize,
    };
  });
