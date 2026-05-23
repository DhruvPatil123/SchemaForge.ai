"use client";

import { FormEvent, useState } from "react";
import { Bug, CheckCircle2, LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitFeedback, type FeedbackType } from "@/lib/api";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@schemaforge.ai";

const contactOptions = [
  { icon: LifeBuoy, title: "Product support", detail: "Usage questions, workspace issues, exports, and templates." },
  { icon: Bug, title: "Bug reports", detail: "Broken flows, incorrect output, rendering problems, and API errors." },
  { icon: ShieldAlert, title: "Security", detail: "Responsible disclosure and account or data concerns." },
];

export default function SupportPage() {
  const [type, setType] = useState<FeedbackType>("support");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (message.trim().length < 10) {
      setError("Please add a little more detail before sending.");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        type,
        name,
        email,
        subject,
        message,
        page_url: window.location.href,
        user_agent: window.navigator.userAgent,
      });
      setNotice("Thanks, your message has been recorded.");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <p className="text-sm font-medium text-indigo-300">Support</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Contact SchemaForge AI</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Send a support request or bug report. Messages are stored for follow-up, and urgent
            security issues can go directly to email.
          </p>

          <div className="mt-8 space-y-4">
            {contactOptions.map((option) => (
              <div key={option.title} className="flex gap-4 rounded-lg border border-border bg-card/40 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                  <option.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{option.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{option.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href={`mailto:${supportEmail}`}
            className="mt-6 inline-flex items-center gap-2 text-sm text-indigo-300 underline-offset-4 hover:underline"
          >
            <Mail className="h-4 w-4" />
            {supportEmail}
          </a>
        </section>

        <section className="rounded-lg border border-border bg-card/50 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as FeedbackType)}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="support">Support</option>
                  <option value="bug">Bug report</option>
                  <option value="billing">Billing</option>
                  <option value="security">Security</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What should we look at?"
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                placeholder="Include steps to reproduce, expected behavior, screenshots, account email, or relevant schema details."
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </label>

            {notice && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {notice}
              </p>
            )}
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send message"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
