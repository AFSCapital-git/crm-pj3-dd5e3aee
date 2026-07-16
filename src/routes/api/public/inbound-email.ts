import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { CODIGO_RASTREIO_REGEX } from "@/lib/inbound-email";

interface InboundEmailPayload {
  from?: string;
  sender?: string;
  subject?: string;
  text?: string;
  body?: string;
  body_text?: string;
  date?: string;
  timestamp?: string;
  message_id?: string;
  messageId?: string;
  attachments?: unknown[];
}

interface DatabaseError extends Error {
  code?: string;
}

// Corpo esperado (JSON):
// {
//   "from": "fulano@empresa.com",
//   "subject": "Re: [PRJ-4821] Contrato",
//   "text": "...",              // corpo em texto puro
//   "date": "2026-07-14T12:00:00Z",
//   "message_id": "<abc@mail>", // opcional; usado para dedup
//   "attachments": [{"filename":"contrato.pdf","size":12345,"content_type":"application/pdf"}]
// }
//
// Autenticação: header  Authorization: Bearer <INBOUND_EMAIL_SECRET>

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function extractCode(subject: string | undefined | null): string | null {
  if (!subject) return null;
  const m = subject.match(CODIGO_RASTREIO_REGEX);
  return m ? m[0].toUpperCase() : null;
}

function dedupHash(payload: {
  message_id?: string | null;
  from?: string | null;
  subject?: string | null;
  date?: string | null;
  text?: string | null;
}) {
  const key = payload.message_id
    ? `mid:${payload.message_id}`
    : `raw:${payload.from ?? ""}|${payload.subject ?? ""}|${payload.date ?? ""}|${(
        payload.text ?? ""
      ).slice(0, 500)}`;
  return createHash("sha256").update(key).digest("hex");
}

export const Route = createFileRoute("/api/public/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INBOUND_EMAIL_SECRET;
        if (!secret) {
          return new Response("Server misconfigured: INBOUND_EMAIL_SECRET missing", {
            status: 500,
          });
        }
        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.replace(/^Bearer\s+/i, "");
        if (!provided || !safeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: InboundEmailPayload;
        try {
          payload = (await request.json()) as InboundEmailPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const from: string = String(payload.from ?? payload.sender ?? "").trim();
        const subject: string = String(payload.subject ?? "").trim();
        const text: string = String(payload.text ?? payload.body ?? payload.body_text ?? "");
        const date: string | null = payload.date ?? payload.timestamp ?? null;
        const messageId: string | null = payload.message_id ?? payload.messageId ?? null;
        const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

        if (!from) return new Response("from required", { status: 400 });

        const hash = dedupHash({ message_id: messageId, from, subject, date, text });
        const code = extractCode(subject);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const isDup = (err: DatabaseError | null) =>
          err &&
          (err.code === "23505" ||
            String(err.message ?? "")
              .toLowerCase()
              .includes("duplicate"));

        if (code) {
          const { data: projeto } = await supabaseAdmin
            .from("projetos")
            .select("id")
            .eq("codigo_rastreio", code)
            .maybeSingle();

          if (projeto) {
            // Dedup transparente: checa antes para responder explicitamente
            const { data: existing } = await supabaseAdmin
              .from("emails_vinculados")
              .select("id")
              .eq("projeto_id", projeto.id)
              .eq("dedup_hash", hash)
              .maybeSingle();
            if (existing) {
              return Response.json({
                status: "duplicate",
                codigo: code,
                projeto_id: projeto.id,
                dedup_hash: hash,
                email_id: existing.id,
              });
            }
            const { data: inserted, error } = await supabaseAdmin
              .from("emails_vinculados")
              .insert({
                projeto_id: projeto.id,
                remetente_original: from,
                assunto: subject || null,
                corpo_texto: text || null,
                data_email_original: date,
                anexos_referenciados: attachments as any,
                message_id: messageId,
                dedup_hash: hash,
              })
              .select("id")
              .maybeSingle();
            if (error) {
              if (isDup(error)) {
                return Response.json({
                  status: "duplicate",
                  codigo: code,
                  projeto_id: projeto.id,
                  dedup_hash: hash,
                });
              }
              console.error("inbound-email insert error", error);
              return new Response("DB error", { status: 500 });
            }
            return Response.json({
              status: "linked",
              codigo: code,
              projeto_id: projeto.id,
              dedup_hash: hash,
              email_id: inserted?.id,
            });
          }

          // código presente mas não corresponde a projeto → fila com motivo
          const { error: errQ } = await supabaseAdmin.from("emails_nao_vinculados").insert({
            remetente_original: from,
            assunto: subject || null,
            corpo_texto: text || null,
            data_email_original: date,
            anexos_referenciados: attachments as any,
            message_id: messageId,
            dedup_hash: hash,
            motivo: `codigo_invalido:${code}`,
          });
          if (errQ && isDup(errQ)) {
            return Response.json({
              status: "duplicate",
              codigo: code,
              dedup_hash: hash,
              queue: true,
            });
          }
          return Response.json({ status: "unmatched", codigo: code, dedup_hash: hash });
        }

        // sem código → fila de revisão manual
        const { error: errQ2 } = await supabaseAdmin.from("emails_nao_vinculados").insert({
          remetente_original: from,
          assunto: subject || null,
          corpo_texto: text || null,
          data_email_original: date,
          anexos_referenciados: attachments as any,
          message_id: messageId,
          dedup_hash: hash,
          motivo: "codigo_ausente",
        });
        if (errQ2 && isDup(errQ2)) {
          return Response.json({ status: "duplicate", dedup_hash: hash, queue: true });
        }
        return Response.json({ status: "queued", dedup_hash: hash });
      },
    },
  },
});
