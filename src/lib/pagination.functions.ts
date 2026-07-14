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
        "id,razao_social,cnpj,porte,status,consultor:consultor_responsavel_id(id,nome,email),criado_em",
      );

    // Cursor: busca o próximo item após o cursor (se fornecido)
    if (cursor) {
      const { data: cursorRow } = await context.supabase
        .from("empresas_clientes")
        .select("criado_em")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        // Usar created_at para ordenação, depois ID para tiebreak
        query = query.or(
          `criado_em.lt.${new Date(cursorRow.criado_em).toISOString()},and(criado_em.eq.${new Date(cursorRow.criado_em).toISOString()},id.lt.${cursor})`,
        );
      }
    }

    // Buscar pageSize + 1 para saber se há mais
    const { data: rows, error } = await query
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
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
      .select("id,nome,categoria,orgao,prazo_submissao,ativo,criado_em");

    if (cursor) {
      const { data: cursorRow } = await context.supabase
        .from("linhas_editais_finep")
        .select("prazo_submissao,criado_em")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        // Ordenar por data do prazo (null last), depois criado_em
        const prazo = cursorRow.prazo_submissao;
        const created = new Date(cursorRow.criado_em).toISOString();

        if (prazo) {
          query = query.or(
            `prazo_submissao.gt.${prazo},and(prazo_submissao.eq.${prazo},criado_em.lt.${created})`,
          );
        } else {
          // Se cursor tem prazo = null, pega itens com prazo != null OU (prazo = null E criado < cursor)
          query = query.or(
            `prazo_submissao.not.is.null,and(prazo_submissao.is.null,criado_em.lt.${created})`,
          );
        }
      }
    }

    const { data: rows, error } = await query
      .order("prazo_submissao", { ascending: true, nullsFirst: false })
      .order("criado_em", { ascending: false })
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
        "id,projeto_id,tipo,data_prevista,status,urgencia,nome_projeto,empresa_razao_social,dias_para_vencer,criado_em",
      );

    if (cursor) {
      const { data: cursorRow } = await context.supabase
        .from("marcos_com_urgencia")
        .select("data_prevista,criado_em")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        const dataPrevista = cursorRow.data_prevista;
        const created = new Date(cursorRow.criado_em).toISOString();

        query = query.or(
          `data_prevista.gt.${dataPrevista},and(data_prevista.eq.${dataPrevista},criado_em.lt.${created})`,
        );
      }
    }

    const { data: rows, error } = await query
      .order("data_prevista", { ascending: true })
      .order("criado_em", { ascending: false })
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
