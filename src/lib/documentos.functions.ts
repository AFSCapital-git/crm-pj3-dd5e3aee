import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "documentos-projetos";

const tipoDoc = z.enum(["material", "contrato", "aditivo", "relatorio", "outro"]);

export const listDocumentosByProjeto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projeto_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("documentos")
      .select("*, autor:usuarios_internos!documentos_enviado_por_fkey(id,nome)")
      .eq("projeto_id", data.projeto_id)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const registerDocumentoVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projeto_id: z.string().uuid(),
        grupo_documento_id: z.string().uuid().nullable().optional(),
        tipo: tipoDoc,
        nome_arquivo: z.string().min(1).max(255),
        storage_path: z.string().min(1),
        tamanho_arquivo: z.number().int().nonnegative(),
        mime_type: z.string().max(255).nullable().optional(),
        descricao_da_versao: z.string().max(1000).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.grupo_documento_id) {
      // Nova versão via RPC atômica
      const { data: row, error } = await supabase.rpc(
        "registrar_nova_versao_documento",
        {
          _projeto_id: data.projeto_id,
          _grupo_documento_id: data.grupo_documento_id,
          _tipo: data.tipo,
          _nome_arquivo: data.nome_arquivo,
          _storage_path: data.storage_path,
          _tamanho_arquivo: data.tamanho_arquivo,
          _mime_type: data.mime_type ?? null,
          _descricao: data.descricao_da_versao ?? "",
        },
      );
      if (error) throw error;
      return row;
    }

    // Novo grupo (v1)
    const grupo = crypto.randomUUID();
    const { data: row, error } = await supabase
      .from("documentos")
      .insert({
        projeto_id: data.projeto_id,
        grupo_documento_id: grupo,
        tipo: data.tipo,
        nome_arquivo: data.nome_arquivo,
        numero_versao: 1,
        storage_path: data.storage_path,
        tamanho_arquivo: data.tamanho_arquivo,
        mime_type: data.mime_type ?? null,
        enviado_por: userId,
        descricao_da_versao: data.descricao_da_versao ?? "",
        e_versao_atual: true,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const getDocumentoDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { documento_id: string }) =>
    z.object({ documento_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documentos")
      .select("id, storage_path, nome_arquivo")
      .eq("id", data.documento_id)
      .maybeSingle();
    if (error) throw error;
    if (!doc) throw new Error("Documento não encontrado");

    const { data: signed, error: sErr } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 300, { download: doc.nome_arquivo });
    if (sErr) throw sErr;
    return { url: signed.signedUrl, nome_arquivo: doc.nome_arquivo };
  });
