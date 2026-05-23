"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reviewSchema, type SchemaReview } from "@/lib/api";

export function SchemaReviewPanel({ schemaId }: { schemaId: string }) {
  const [review, setReview] = useState<SchemaReview | null>(null);
  const [loading, setLoading] = useState(false);

  async function runReview() {
    setLoading(true);
    try {
      setReview(await reviewSchema(schemaId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold">AI Schema Review</h3>
        </div>
        <Button size="sm" variant="outline" onClick={runReview} disabled={loading}>
          {loading ? "Reviewing..." : "Run Review"}
        </Button>
      </div>
      {review && (
        <div className="mt-3 space-y-2 text-sm">
          <Badge variant="success">Score: {review.score}/100</Badge>
          <p className="text-muted-foreground">{review.summary}</p>
          {review.issues?.map((i, idx) => (
            <p key={idx} className="text-amber-300 text-xs">⚠ {i}</p>
          ))}
          {review.recommendations?.slice(0, 3).map((r, idx) => (
            <p key={idx} className="text-xs">
              <span className="text-indigo-400">[{r.priority}]</span> {r.title}: {r.detail}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
