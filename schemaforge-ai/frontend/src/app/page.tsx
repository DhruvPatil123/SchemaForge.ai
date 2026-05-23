"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  Globe,
  Layers,
  MessageSquare,
  Sparkles,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFeedback, submitFeedback, type FeedbackType } from "@/lib/api";

const features = [
  {
    icon: Globe,
    title: "15+ Database Dialects",
    description: "PostgreSQL, MySQL, SQLite, SQL Server, Oracle, MongoDB, Snowflake, and more.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Understanding",
    description: "Semantic comprehension of business domains — not just keyword matching.",
  },
  {
    icon: Layers,
    title: "Enterprise-Grade Output",
    description: "3NF normalization, composite indexes, FKs, check constraints, and partitioning hints.",
  },
  {
    icon: MessageSquare,
    title: "Iterative Refinement",
    description: "Chat interface to evolve schemas incrementally without starting over.",
  },
  {
    icon: GitBranch,
    title: "Version Control",
    description: "Git-like versioning with diff views, rollback, and migration scripts.",
  },
  {
    icon: Database,
    title: "Interactive ERD",
    description: "Drag-and-drop ERD with zoom, pan, minimap, and export to PNG/SVG.",
  },
];

const dialects = [
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "SQL Server",
  "Oracle",
  "MongoDB",
  "Snowflake",
  "BigQuery",
  "Cassandra",
  "DynamoDB",
];

interface FeedbackRecord {
  id: string;
  type: string;
  name?: string;
  email?: string;
  subject?: string;
  message: string;
  created_at: string;
}

const INITIAL_FEEDBACKS: FeedbackRecord[] = [
  {
    id: "fb-1",
    type: "general",
    name: "Devon M.",
    email: "devon@example.com",
    subject: "Amazing Postgres generation",
    message: "The 3NF SQL schema normalization worked flawlessly for our e-commerce multi-tenant setup! Real time-saver and beautiful output.",
    created_at: "2026-05-21T07:42:00.000Z"
  },
  {
    id: "fb-2",
    type: "general",
    name: "Elena Rostova",
    email: "elena@example.com",
    subject: "Beautiful ERD",
    message: "The interactive ERD schema canvas is extremely responsive. Downloading directly as PNG/SVG makes presentation slides a breeze.",
    created_at: "2026-05-22T03:42:00.000Z"
  },
  {
    id: "fb-3",
    type: "general",
    name: "Keanu L.",
    email: "keanu@example.com",
    subject: "Saved hours of work",
    message: "Usually, I spend hours drafting initial schemas and indices on whiteboard. Plunked in pure English, got an optimized SQL/schema in 5s!",
    created_at: "2026-05-22T07:27:00.000Z"
  }
];

export default function HomePage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>(INITIAL_FEEDBACKS);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<FeedbackType>("general");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadFeedbacks = async () => {
    try {
      const res = await getFeedback();
      const sorted = res.feedback.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setFeedbacks(sorted);
    } catch {
      // fallback safe empty array
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadFeedbacks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setSuccess(false);

    try {
      await submitFeedback({
        type,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        subject: "Homepage Feedback Review",
        message: message.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
      setType("general");
      loadFeedbacks();
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      // error silences gracefully
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center lg:px-6 lg:pt-24">
        <Badge variant="outline" className="mb-6">
          Plain English → Production DDL
        </Badge>
        <h1 className="animate-slide-up text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Design databases
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            in plain English
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          SchemaForge AI transforms natural language descriptions into production-ready
          schemas with tables, relationships, indexes, and constraints — across every major
          database platform.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/workspace">
            <Button size="lg" className="gap-2 px-8">
              <Zap className="h-5 w-5" />
              Start Generating
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/templates">
            <Button size="lg" variant="outline">
              Browse Templates
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Time-to-first-schema under 8 seconds · 92%+ accuracy · 3NF normalized
        </p>
      </section>

      <section className="border-y border-border bg-card/30 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4">
          {dialects.map((d) => (
            <span
              key={d}
              className="rounded-full border border-border/60 bg-background/50 px-3 py-1 font-mono text-xs text-muted-foreground"
            >
              {d}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
        <h2 className="text-center text-2xl font-bold">Built for every role on your team</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          From pragmatic developers to data architects and product managers.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card/50 p-6 transition hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 transition group-hover:bg-indigo-500/25">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 lg:px-6">
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/50 to-violet-950/30 p-8 lg:p-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Example prompt
          </p>
          <blockquote className="mt-4 text-lg leading-relaxed text-foreground/90">
            &ldquo;I&apos;m building a multi-vendor e-commerce platform. Each vendor has multiple
            products with variants (size, color). Customers place orders, each order has line items.
            Support discount codes and product reviews.&rdquo;
          </blockquote>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>→ 14 tables</span>
            <span>→ PKs, FKs, indexes</span>
            <span>→ Under 5 seconds</span>
          </div>
          <Link href="/workspace" className="mt-8 inline-block">
            <Button>Try this example</Button>
          </Link>
        </div>
      </section>

      {/* User Feedback & Comments Thread Section */}
      <section className="mx-auto max-w-5xl px-4 pb-24 lg:px-6">
        <div className="border-t border-border pt-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-3 px-3 py-1 text-xs border-indigo-500/20 text-indigo-300">
              Community & Cooperation
            </Badge>
            <h2 className="text-2xl font-bold md:text-3xl">Recent User Reviews & Feedback</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              What other developers and architects are saying about SchemaForge. Submit your own reviews or system suggestions in real-time right from here!
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Live Feedbacks List */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-indigo-400" />
                Live Feed thread
                <span className="text-[10px] tracking-wider text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full font-mono">
                  {feedbacks.length} messages
                </span>
              </h3>

              {loading ? (
                <div className="rounded-xl border border-border/50 bg-card/25 p-8 text-center text-xs text-muted-foreground animate-pulse">
                  Querying the feedback records...
                </div>
              ) : feedbacks.length === 0 ? (
                <div className="rounded-xl border border-border/50 bg-card/25 p-8 text-center text-xs text-muted-foreground font-sans">
                  No feedback received yet. Be the first to share your experience!
                </div>
              ) : (
                <div className="max-h-[480px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {feedbacks.map((fb) => (
                    <div
                      key={fb.id}
                      className="rounded-xl border border-border/60 bg-card/30 p-4 text-xs transition duration-200 hover:border-indigo-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-indigo-300 font-mono">
                            {fb.name || "Anonymous Member"}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider bg-violet-500/15 text-violet-300 px-1.5 py-0.5 rounded border border-violet-500/10 font-mono scale-90">
                            {fb.type || "general"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {isMounted ? new Date(fb.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) : ""}
                        </span>
                      </div>
                      <p className="text-muted-foreground font-sans leading-relaxed text-[12px] break-words">
                        {fb.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Feedback Form */}
            <div className="lg:col-span-5 rounded-xl border border-border bg-card/40 p-6 shadow-sm">
              <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                Write a Review
              </h3>
              <p className="text-xs text-muted-foreground mb-5">
                Spotted a gap? Have an optimization idea? Publish a quick thought.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 animation-fade-in">
                  <label htmlFor="feedback-name" className="text-[11px] font-medium text-muted-foreground block font-mono">
                    Your Name (optional)
                  </label>
                  <input
                    id="feedback-name"
                    type="text"
                    placeholder="e.g., Donald Knuth"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-background rounded-lg border border-border outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="feedback-email" className="text-[11px] font-medium text-muted-foreground block font-mono">
                    Email Address (optional)
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    placeholder="e.g., donald@stanford.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-background rounded-lg border border-border outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="feedback-type" className="text-[11px] font-medium text-muted-foreground block font-mono">
                    Feedback Category
                  </label>
                  <select
                    id="feedback-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as FeedbackType)}
                    className="w-full text-xs px-3 py-2 bg-background rounded-lg border border-border outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-muted-foreground text-[11px]"
                  >
                    <option value="general">General Feedback</option>
                    <option value="support">Feature Request</option>
                    <option value="bug">Report Bug</option>
                    <option value="security">Security Audit</option>
                    <option value="billing">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="feedback-msg" className="text-[11px] font-medium text-muted-foreground block font-mono">
                    Your Review / Suggestions
                  </label>
                  <textarea
                    id="feedback-msg"
                    rows={4}
                    placeholder="Write your constructive thoughts here..."
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-background rounded-lg border border-border outline-none focus:ring-1 focus:ring-indigo-500 font-sans resize-none"
                  />
                </div>

                {success && (
                  <div className="text-xs bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-3.5 py-2.5 rounded-lg transition duration-200">
                    ✨ Thank you! Your feedback has been posted successfully and added to the list.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-500 text-xs py-2 h-9"
                >
                  {submitting ? "Posting review..." : "Publish Feedback"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
