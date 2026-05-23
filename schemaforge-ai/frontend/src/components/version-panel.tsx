"use client";

import { useState } from "react";
import { GitBranch, RotateCcw, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSchemaDiff, rollbackSchema } from "@/lib/api";
import type { GenerateResponse, SchemaDiff } from "@/lib/api";

export function VersionPanel({
  result,
  onRollback,
}: {
  result: GenerateResponse;
  onRollback: (res: GenerateResponse) => void;
}) {
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [fromV, setFromV] = useState(1);
  const [toV, setToV] = useState(result.version);
  const [loading, setLoading] = useState(false);

  async function loadDiff() {
    setLoading(true);
    try {
      const d = await getSchemaDiff(result.schema_id, fromV, toV);
      setDiff(d);
    } finally {
      setLoading(false);
    }
  }

  async function rollback(v: number) {
    const res = await rollbackSchema(result.schema_id, v);
    onRollback(res);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-semibold">Version History</h3>
        <span className="text-xs text-muted-foreground">v{result.version}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min={1}
          max={result.version}
          value={fromV}
          onChange={(e) => setFromV(Number(e.target.value))}
          className="w-14 rounded border border-border bg-background px-2 py-1 text-xs"
          aria-label="From version"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <input
          type="number"
          min={1}
          max={result.version}
          value={toV}
          onChange={(e) => setToV(Number(e.target.value))}
          className="w-14 rounded border border-border bg-background px-2 py-1 text-xs"
          aria-label="To version"
        />
        <Button size="sm" variant="outline" onClick={loadDiff} disabled={loading} className="gap-1">
          <GitCompare className="h-3 w-3" />
          Diff
        </Button>
        {fromV < result.version && (
          <Button size="sm" variant="ghost" onClick={() => rollback(fromV)} className="gap-1">
            <RotateCcw className="h-3 w-3" />
            Rollback
          </Button>
        )}
      </div>
      {diff && (
        <div className="max-h-40 overflow-y-auto rounded-lg bg-background/50 p-2 text-xs">
          {diff.added_tables.length > 0 && <p className="text-emerald-400">+ Tables: {diff.added_tables.join(", ")}</p>}
          {diff.removed_tables.length > 0 && <p className="text-red-400">- Tables: {diff.removed_tables.join(", ")}</p>}
          {diff.changed_tables.map((c) => (
            <p key={c.table} className="text-amber-300">
              ~ {c.table}: +{c.added_columns.join(",")} -{c.removed_columns.join(",")}
            </p>
          ))}
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">{diff.migration_sql.slice(0, 500)}...</pre>
        </div>
      )}
    </div>
  );
}
