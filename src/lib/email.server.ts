// This file is server-only — never import statically in *.functions.ts or route files.
// Always use: const { sendEmail } = await import("@/lib/email.server") inside handlers.
import { Resend } from "resend";

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY environment variable. Configure em Lovable Cloud / .env.",
    );
  }
  return new Resend(apiKey);
}

let _resend: Resend | undefined;

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("Missing RESEND_FROM_EMAIL environment variable. Configure em .env.");
  }

  if (!_resend) _resend = createResendClient();

  const { error } = await _resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
