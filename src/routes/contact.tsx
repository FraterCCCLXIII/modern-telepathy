import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { sendContact } from "@/lib/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Modern Telepathy" },
      { name: "description", content: "Send a message to Modern Telepathy." },
    ],
  }),
  component: ContactPage,
});

const field =
  "w-full rounded-xl bg-card px-4 py-3 text-base ring-1 ring-black/10 focus:ring-2 focus:ring-primary outline-none";
const label = "block font-mono text-[.7rem] uppercase tracking-[.16em] text-zinc-500 mb-2";

function ContactPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setState("sending");
    setError("");
    try {
      const res = await sendContact({
        data: {
          name: String(f.get("name") ?? ""),
          email: String(f.get("email") ?? ""),
          message: String(f.get("message") ?? ""),
          website: String(f.get("website") ?? ""),
        },
      });
      if (res.ok) {
        setState("sent");
        form.reset();
      } else {
        setError(res.error);
        setState("idle");
      }
    } catch (err) {
      // Validation errors from the server arrive as a thrown error with a JSON message.
      let msg = "Please check the form and try again.";
      try {
        const issues = JSON.parse((err as Error).message);
        if (Array.isArray(issues) && issues[0]?.message) msg = issues[0].message;
      } catch {
        /* keep default */
      }
      setError(msg);
      setState("idle");
    }
  }

  return (
    <div className="py-24 bg-canvas">
      <div className="max-w-screen-xl mx-auto px-6 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-none">Contact</h1>
          <p className="mt-8 text-lg text-zinc-500 text-pretty leading-relaxed max-w-[40ch]">
            Questions, collaboration, press. Write a few lines and it goes straight to our inbox.
          </p>
        </div>
        <div className="md:col-span-7 max-w-xl">
          {state === "sent" ? (
            <div role="status" className="rounded-2xl bg-card p-8 ring-1 ring-black/5">
              <h2 className="text-2xl font-medium mb-2">Message sent</h2>
              <p className="text-zinc-500">Thank you. We will reply by email.</p>
              <button type="button" onClick={() => setState("idle")} className="mt-6 text-sm font-medium underline underline-offset-4">
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <div>
                <label htmlFor="name" className={label}>Name</label>
                <input id="name" name="name" required maxLength={120} autoComplete="name" className={field} />
              </div>
              <div>
                <label htmlFor="email" className={label}>Email</label>
                <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className={field} />
              </div>
              <div>
                <label htmlFor="message" className={label}>Message</label>
                <textarea id="message" name="message" required minLength={10} maxLength={5000} rows={7} className={field} />
              </div>
              {/* Honeypot: hidden from people, filled by bots. */}
              <div aria-hidden className="absolute -left-[9999px]">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={state === "sending"}
                className="inline-flex items-center rounded-xl bg-primary text-primary-foreground px-6 py-3 font-mono text-[.7rem] uppercase tracking-[.16em] disabled:opacity-60"
              >
                {state === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
