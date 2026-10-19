import "server-only";
import { emailTransportName } from "@/server/env";

export type OutgoingEmail = { from: string; to: string; replyTo?: string; subject: string; html: string; text: string };
export type TransportResult = { status: "logged" | "sent" | "failed"; providerMessageId?: string; error?: string };

export interface EmailTransport {
  readonly name: string;
  send(email: OutgoingEmail): Promise<TransportResult>;
}

/** Default. Sends nothing; the notification row in the database is the record (Admin → Outbox). */
export const logTransport: EmailTransport = {
  name: "log",
  async send(email) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[email:log] to=${email.to} subject="${email.subject}"`);
    }
    return { status: "logged" };
  },
};

/**
 * Resend (https://resend.com) — only used when EMAIL_TRANSPORT=resend AND
 * RESEND_API_KEY is set. Off by default; enable only once production email is approved.
 */
export const resendTransport: EmailTransport = {
  name: "resend",
  async send(email) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { status: "failed", error: "RESEND_API_KEY is not set" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: email.from,
          to: [email.to],
          reply_to: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { status: "failed", error: body.message ?? `HTTP ${res.status}` };
      return { status: "sent", providerMessageId: body.id };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export function getTransport(): EmailTransport {
  return emailTransportName() === "resend" ? resendTransport : logTransport;
}
