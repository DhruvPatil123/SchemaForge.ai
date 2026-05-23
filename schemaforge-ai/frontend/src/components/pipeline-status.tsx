"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  stage: string;
  status: string;
  detail: string;
}

export function PipelineStatus({ stages, loading }: { stages: Stage[]; loading?: boolean }) {
  if (!stages.length && !loading) return null;

  const displayStages = loading
    ? [
        { stage: "Intent Classifier", status: "running", detail: "Analyzing prompt..." },
        { stage: "Entity Extractor", status: "pending", detail: "" },
        { stage: "Relationship Mapper", status: "pending", detail: "" },
        { stage: "DDL Synthesizer", status: "pending", detail: "" },
      ]
    : stages;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        AI Pipeline
      </p>
      {displayStages.map((s, i) => (
        <div key={i} className="flex items-start gap-3">
          {s.status === "complete" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : s.status === "running" ? (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-indigo-400" />
          ) : (
            <div className="mt-1 h-3 w-3 shrink-0 rounded-full border border-border" />
          )}
          <div>
            <p className={cn("text-sm font-medium", s.status === "pending" && "text-muted-foreground")}>
              {s.stage}
            </p>
            {s.detail && (
              <p className="text-xs text-muted-foreground">{s.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
