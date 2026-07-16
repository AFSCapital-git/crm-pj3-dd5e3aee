// Endereço público que recebe os e-mails encaminhados.
// Configure a rota do seu provedor de e-mail (Mailgun Routes, SendGrid Inbound Parse,
// CloudMailin, Postmark Inbound, Zapier Email Parser, etc.) para entregar mensagens
// enviadas a este endereço no webhook POST /api/public/inbound-email.
export const INBOUND_EMAIL_ADDRESS =
  ((import.meta as any).env?.VITE_INBOUND_EMAIL_ADDRESS as string | undefined) ??
  "projetos@gestorfinep.app";

// Regex do código de rastreio: PRJ-XXXX (dígitos ou letras/dígitos).
export const CODIGO_RASTREIO_REGEX = /PRJ-[A-Z0-9]{4,10}/i;
