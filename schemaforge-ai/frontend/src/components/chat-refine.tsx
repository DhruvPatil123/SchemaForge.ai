"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Add soft delete to the orders table",
  "Denormalize product name into order_items",
  "Add full-text search to products",
  "Add audit columns to all tables",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatRefineProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  messages?: Message[];
}

export function ChatRefine({ onSend, disabled, messages = [] }: ChatRefineProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text: string) {
    if (!text.trim() || sending || disabled) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setInput("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card/30">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold">Schema Refinement</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Evolve your schema incrementally via chat
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Try a refinement suggestion below
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              m.role === "user"
                ? "ml-4 bg-indigo-600/20 text-foreground"
                : "mr-4 bg-muted/50 text-muted-foreground"
            )}
          >
            {m.content}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSend(s)}
            disabled={disabled || sending}
            className="rounded-full border border-border bg-background/50 px-3 py-1 text-[11px] text-muted-foreground transition hover:border-indigo-500/50 hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          placeholder="e.g. Add soft delete to orders..."
          disabled={disabled || sending}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
        <Button
          size="icon"
          onClick={() => handleSend(input)}
          disabled={!input.trim() || disabled || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
