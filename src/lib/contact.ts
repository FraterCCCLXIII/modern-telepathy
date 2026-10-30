import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Where contact messages go. */
const TO = "openartist@gmail.com";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(200),
  message: z.string().trim().min(10, "Please write a little more").max(5000),
  /** Honeypot: real visitors leave it empty. */
  website: z.string().max(0).optional().default(""),
});

export type ContactResult = { ok: true } | { ok: false; error: string };

// Per-instance throttle: one message per address per minute. Good enough to blunt a loop; not a real rate limiter.
const lastSent = new Map<string, number>();

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Sends the message through Resend (https://resend.com).
 * Server env: RESEND_API_KEY (required), CONTACT_FROM (optional; defaults to Resend's onboarding sender,
 * which can only deliver to the email the Resend account was created with).
 */
export const sendContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<ContactResult> => {
    if (data.website) return { ok: true }; // honeypot filled: pretend success, send nothing
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.error("contact: RESEND_API_KEY is not set");
      return { ok: false, error: "The contact form is not configured yet. Please email openartist@gmail.com directly." };
    }
    const now = Date.now();
    const k = data.email.toLowerCase();
    if (now - (lastSent.get(k) ?? 0) < 60_000) return { ok: false, error: "Please wait a minute before sending another message." };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "Modern Telepathy <onboarding@resend.dev>",
        to: [TO],
        reply_to: data.email,
        subject: `Contact form: ${data.name}`.slice(0, 150),
        text: `From: ${data.name} <${data.email}>\n\n${data.message}`,
        html: `<p><b>${esc(data.name)}</b> &lt;${esc(data.email)}&gt;</p><p style="white-space:pre-wrap">${esc(data.message)}</p>`,
      }),
    });
    if (!res.ok) {
      console.error("contact: Resend error", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "Sorry, the message could not be sent. Please email openartist@gmail.com directly." };
    }
    lastSent.set(k, now);
    return { ok: true };
  });
