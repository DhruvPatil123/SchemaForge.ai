"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Table2, ArrowRight } from "lucide-react";
import { getTemplates, type TemplateInfo } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "All",
  "E-commerce",
  "SaaS",
  "CMS",
  "Healthcare",
  "Financial",
  "Social",
  "IoT",
  "Logistics",
  "HR",
  "Analytics",
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cat = category === "All" ? undefined : category;
        const res = await getTemplates(cat, search || undefined);
        setTemplates(res.templates);
      } catch {
        setTemplates(FALLBACK_TEMPLATES);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [category, search]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold">Template Library</h1>
        <p className="mt-2 text-muted-foreground">
          100+ curated schema templates for common use cases — searchable and fully customizable.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-xl border border-border bg-card/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-border bg-card/30"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}

      {!loading && templates.length === 0 && (
        <p className="text-center text-muted-foreground">No templates match your search.</p>
      )}
    </main>
  );
}

function TemplateCard({ template }: { template: TemplateInfo }) {
  const promptParam = encodeURIComponent(template.prompt);

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card/50 p-5 transition hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="flex items-start justify-between">
        <Badge variant="outline">{template.category}</Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          {template.table_count} tables
        </span>
      </div>
      <h3 className="mt-3 font-semibold group-hover:text-indigo-300">{template.name}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-2">
        {template.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        href={`/workspace?prompt=${promptParam}`}
        className="mt-4"
      >
        <Button variant="outline" size="sm" className="w-full gap-2 group-hover:border-indigo-500/50">
          Use template
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </article>
  );
}

const FALLBACK_TEMPLATES: TemplateInfo[] = [
  {
    id: "ecommerce-multivendor",
    name: "Multi-Vendor E-Commerce",
    category: "E-commerce",
    description: "Vendors, products with variants, orders, discounts, and reviews.",
    table_count: 14,
    prompt:
      "I'm building a multi-vendor e-commerce platform. Each vendor has multiple products with variants (size, color). Customers place orders, each order has line items. Support discount codes and product reviews.",
    tags: ["ecommerce", "marketplace"],
  },
];
