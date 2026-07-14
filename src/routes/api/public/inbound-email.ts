import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { CODIGO_RASTREIO_REGEX } from "@/lib/inbound-email";

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
          return new Response("Server misconfigured: INBOUND_EMAIL_SECRET missing", { status: 500 });
        }
        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.replace(/^Bearer\s+/i, "");
        if (!provided || !safeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
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

        if (code) {
          const { data: projeto } = await supabaseAdmin
            .from("projetos")
            .select("id")
            .eq("codigo_rastreio", code)
            .maybeSingle();

          if (projeto) {
            const { error } = await supabaseAdmin.from("emails_vinculados").insert({
              projeto_id: projeto.id,
              remetente_original: from,
              assunto: subject || null,
              corpo_texto: text || null,
              data_email_original: date,
              anexos_referenciados: attachments,
              message_id: messageId,
              dedup_hash: hash,
            } as any);
            if (error && !String(error.message).includes("duplicate")) {
              console.error("inbound-email insert error", error);
              return new Response("DB error", { status: 500 });
            }
            return Response.json({ status: "linked", codigo: code, projeto_id: projeto.id });
          }
          // código presente mas não corresponde a projeto → fila com motivo
          await supabaseAdmin
            .from("emails_nao_vinculados")
            .insert({
              remetente_original: from,
              assunto: subject || null,
              corpo_texto: text || null,
              data_email_original: date,
              anexos_referenciados: attachments,
              message_id: messageId,
              dedup_hash: hash,
              motivo: `codigo_invalido:${code}`,
            } as any)
            .then(() => {}, () => {});
          return Response.json({ status: "unmatched", codigo: code });
        }

        // sem código → fila de revisão manual
        await supabaseAdmin
          .from("emails_nao_vinculados")
          .insert({
            remetente_original: from,
            assunto: subject || null,
            corpo_texto: text || null,
            data_email_original: date,
            anexos_referenciados: attachments,
            message_id: messageId,
            dedup_hash: hash,
            motivo: "codigo_ausente",
          } as any)
          .then(() => {}, () => {});
        return Response.json({ status: "queued" });
      },
    },
  },
});
