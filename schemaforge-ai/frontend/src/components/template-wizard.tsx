"use client";

import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFromWizard, type Dialect, type GenerateResponse } from "@/lib/api";

const DOMAINS = ["E-commerce", "SaaS", "Healthcare", "Social", "IoT", "Finance", "CMS", "Analytics"];

export function TemplateWizard({
  dialect,
  onComplete,
}: {
  dialect: Dialect;
  onComplete: (res: GenerateResponse) => void;
}) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("E-commerce");
  const [entities, setEntities] = useState("users, products, orders");
  const [relationships, setRelationships] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await generateFromWizard(
        domain,
        entities.split(",").map((e) => e.trim()).filter(Boolean),
        relationships,
        dialect
      );
      onComplete(res);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1">
        <Wand2 className="h-3.5 w-3.5" />
        Guided Wizard
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div 
            className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-card/95 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-indigo-400" />
                Guided Database Wizard
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-8 w-8 p-0 rounded-full">
                ✕
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Database Domain
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  {DOMAINS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Entities (comma-separated)
                </label>
                <input
                  placeholder="e.g. users, products, orders, reviews"
                  value={entities}
                  onChange={(e) => setEntities(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Relationships (optional)
                </label>
                <input
                  placeholder="e.g. users have many orders, products have variants"
                  value={relationships}
                  onChange={(e) => setRelationships(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Generating..." : "Generate Schema"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
