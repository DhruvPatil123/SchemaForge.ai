"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Copy,
  Download,
  Check,
  Loader2,
  ChevronDown,
  Table2,
  Upload,
  Share2,
  Sun,
  Moon,
  Plus,
  Trash,
  Edit3,
  Save,
  MessageSquare,
  GitCommit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErdViewer } from "@/components/erd-viewer";
import { DdlEditor } from "@/components/ddl-editor";
import { ChatRefine } from "@/components/chat-refine";
import { PipelineStatus } from "@/components/pipeline-status";
import {
  generateSchema,
  refineSchema,
  exportSchema,
  inferFromCsv,
  compareDialects,
  createShareLink,
  getUsage,
  getHealth,
  listSchemas,
  getSchema,
  updateSchema,
  getComments,
  addComment,
  type Comment,
  type Dialect,
  type GenerateResponse,
  type NamingConvention,
  type UsageStats,
  type SchemaAST,
  type TableDef,
  type ColumnDef,
} from "@/lib/api";
import { VersionPanel } from "@/components/version-panel";
import { TemplateWizard } from "@/components/template-wizard";
import { SchemaReviewPanel } from "@/components/schema-review-panel";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const DIALECTS: { value: Dialect; label: string; category: string }[] = [
  { value: "postgresql", label: "PostgreSQL", category: "Relational" },
  { value: "mysql", label: "MySQL", category: "Relational" },
  { value: "sqlite", label: "SQLite", category: "Relational" },
  { value: "mssql", label: "SQL Server", category: "Relational" },
  { value: "oracle", label: "Oracle", category: "Relational" },
  { value: "snowflake", label: "Snowflake", category: "Cloud warehouse" },
  { value: "bigquery", label: "BigQuery", category: "Cloud warehouse" },
  { value: "mongodb", label: "MongoDB", category: "Document" },
  { value: "cassandra", label: "Cassandra", category: "Wide-column" },
  { value: "dynamodb", label: "DynamoDB", category: "Key-value" },
];

const EXAMPLE_PROMPT =
  "I'm building a multi-vendor e-commerce platform. Each vendor has multiple products with variants (size, color). Customers place orders, each order has line items. Support discount codes and product reviews.";

type Tab = "erd" | "ddl" | "tables";

export function WorkspaceClient() {
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [dialect, setDialect] = useState<Dialect>("postgresql");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [tab, setTab] = useState<Tab>("erd");
  const [compactErd, setCompactErd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState<NamingConvention>("snake_case");
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [openaiOk, setOpenaiOk] = useState(false);

  // Visual editing schema constructor state handlers
  const [isEditing, setIsEditing] = useState(false);
  const [editSchema, setEditSchema] = useState<SchemaAST | null>(null);
  const [editLabel, setEditLabel] = useState("Direct visual updates");

  const startVisualEdit = () => {
    if (result) {
      setEditSchema(JSON.parse(JSON.stringify(result.schema)));
      setEditLabel("Direct visual update");
      setIsEditing(true);
    }
  };

  const cancelVisualEdit = () => {
    setIsEditing(false);
    setEditSchema(null);
  };

  async function saveVisualEdit() {
    if (!result || !editSchema) return;
    setLoading(true);
    try {
      const res = await updateSchema(result.schema_id, editSchema, editLabel);
      setResult(res);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update schema");
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateTableName = (oldName: string, newName: string) => {
    if (!editSchema) return;
    const cleanNewName = newName.trim().toLowerCase().replace(/[\s\-]+/g, "_");
    if (!cleanNewName) return;
    setEditSchema((prev) => {
      if (!prev) return null;
      const tables = prev.tables.map((t) => {
        if (t.name === oldName) {
          return { ...t, name: cleanNewName };
        }
        return t;
      });
      const relationships = prev.relationships.map((r) => {
        let from_table = r.from_table;
        let to_table = r.to_table;
        if (r.from_table === oldName) from_table = cleanNewName;
        if (r.to_table === oldName) to_table = cleanNewName;
        return { ...r, from_table, to_table };
      });
      return { ...prev, tables, relationships };
    });
  };

  const handleAddTable = () => {
    if (!editSchema) return;
    setEditSchema((prev) => {
      if (!prev) return null;
      const num = prev.tables.length + 1;
      const newTable: TableDef = {
        name: `new_table_${num}`,
        confidence: 1.0,
        comment: "Direct visual addition",
        columns: [
          { name: "id", type: "uuid", nullable: false, primary_key: true, unique: true, confidence: 1.0 }
        ],
        indexes: []
      };
      return { ...prev, tables: [...prev.tables, newTable] };
    });
  };

  const handleDeleteTable = (tableName: string) => {
    if (!editSchema) return;
    setEditSchema((prev) => {
      if (!prev) return null;
      const tables = prev.tables.filter((t) => t.name !== tableName);
      const relationships = prev.relationships.filter((r) => r.from_table !== tableName && r.to_table !== tableName);
      return { ...prev, tables, relationships };
    });
  };

  const handleAddColumn = (tableName: string) => {
    if (!editSchema) return;
    setEditSchema((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((t) => {
          if (t.name === tableName) {
            const index = t.columns.length + 1;
            const newCol: ColumnDef = {
              name: `column_${index}`,
              type: "varchar",
              nullable: true,
              primary_key: false,
              unique: false,
              confidence: 1.0
            };
            return { ...t, columns: [...t.columns, newCol] };
          }
          return t;
        })
      };
    });
  };

  const handleUpdateColumn = (tableName: string, colIndex: number, field: keyof ColumnDef, val: boolean | string | null | undefined) => {
    if (!editSchema) return;
    setEditSchema((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((t) => {
          if (t.name === tableName) {
            const columns = t.columns.map((c, idx) => {
              if (idx === colIndex) {
                const updated = { ...c, [field]: val };
                if (field === "name") {
                  updated.name = String(val).toLowerCase().replace(/[\s\-]+/g, "_");
                }
                return updated;
              }
              return c;
            });
            return { ...t, columns };
          }
          return t;
        })
      };
    });
  };

  const handleDeleteColumn = (tableName: string, colIndex: number) => {
    if (!editSchema) return;
    setEditSchema((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((t) => {
          if (t.name === tableName) {
            return { ...t, columns: t.columns.filter((_, idx) => idx !== colIndex) };
          }
          return t;
        })
      };
    });
  };
  const [history, setHistory] = useState<{ id: string; label?: string }[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSql, setCompareSql] = useState<Record<string, string> | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const p = searchParams.get("prompt");
    if (p) setPrompt(decodeURIComponent(p));
    getHealth().then((h) => setOpenaiOk(h.openai_configured)).catch(() => {});
    getUsage().then(setUsage).catch(() => {});
    listSchemas().then((r) => setHistory(r.schemas.slice(0, 8).map((s) => ({ id: s.id, label: s.label })))).catch(() => {});
  }, [searchParams]);

  const loadSchema = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSchema(id);
      setResult(res);
      setPrompt(res.schema.domain || "");
      setDialect(res.schema.dialect);
      setTab("erd");
      setChatMessages([
        { role: "assistant", content: `Restored workspace for database "${res.schema.name}". You can now review, compare dialects, or refine via chat.` }
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schema");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    const text = prompt.trim() || EXAMPLE_PROMPT;
    setLoading(true);
    setError(null);
    setChatMessages([]);
    try {
      const res = await generateSchema(text, dialect, "3NF", naming);
      setResult(res);
      setTab("erd");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, [prompt, dialect, naming]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleGenerate]);

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const res = await inferFromCsv(file, dialect);
      setResult(res);
      setTab("erd");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare() {
    if (!result) return;
    const data = await compareDialects(result.schema_id, DIALECTS.map((d) => d.value));
    setCompareSql(data.dialects);
    setCompareOpen(true);
  }

  async function handleShare() {
    if (!result) return;
    const { share_token } = await createShareLink(result.schema_id);
    const url = `${window.location.origin}/shared/${share_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleRefine = useCallback(
    async (message: string) => {
      if (!result) return;
      setChatMessages((m) => [...m, { role: "user", content: message }]);
      setLoading(true);
      try {
        const res = await refineSchema(result.schema_id, message);
        setResult(res);
        setChatMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Applied refinement (v${res.version}). Schema now has ${res.schema.tables.length} tables.`,
          },
        ]);
      } catch {
        setChatMessages((m) => [
          ...m,
          { role: "assistant", content: "Refinement failed. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [result]
  );

  async function handleCopy() {
    if (!result?.ddl) return;
    await navigator.clipboard.writeText(result.ddl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleExport(format: string) {
    if (!result) return;
    try {
      const content = await exportSchema(result.schema_id, format, dialect);
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schema.${format === "prisma" ? "prisma" : format === "sqlalchemy" ? "py" : "sql"}`;
      a.click();
    } catch {
      setError("Export failed");
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[1600px] flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[380px]">
        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Describe your domain
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={EXAMPLE_PROMPT}
            rows={6}
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <TemplateWizard dialect={dialect} onComplete={(res) => { setResult(res); setTab("erd"); }} />
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={handleCsv} />
              <span className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> CSV
              </span>
            </label>
            <button type="button" onClick={toggleTheme} className="rounded-lg border border-border p-1.5" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <DialectSelect value={dialect} onChange={setDialect} />
            <select
              value={naming}
              onChange={(e) => setNaming(e.target.value as NamingConvention)}
              className="h-10 rounded-lg border border-border bg-background px-2 text-xs"
              title="Naming convention"
            >
              <option value="snake_case">snake_case</option>
              <option value="camelCase">camelCase</option>
              <option value="PascalCase">PascalCase</option>
            </select>
            <Button onClick={handleGenerate} disabled={loading} className="flex-1 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {openaiOk ? "Claude via OpenRouter connected" : "Fallback engine — set OPENAI_API_KEY in backend/.env"}
            {usage && ` · ${usage.schemas_this_month}/${usage.limit} schemas this month`}
          </p>
          {error && (
            <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}
        </div>

        <PipelineStatus stages={result?.pipeline_stages ?? []} loading={loading && !result} />

        {result && (
          <>
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" title="Average table confidence">
                  {(result.confidence_score * 100).toFixed(0)}% confidence
                </Badge>
                <Badge variant="outline">{result.generation_time_ms}ms</Badge>
                <Badge variant="outline">v{result.version}</Badge>
                <Badge>{result.schema.tables.length} tables</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {result.schema.domain} · {result.schema.normalization} · {result.schema.use_case}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={handleCompare}>Compare dialects</Button>
                <Button size="sm" variant="ghost" onClick={handleShare} className="gap-1"><Share2 className="h-3 w-3" /> Share</Button>
              </div>
            </div>
            <VersionPanel result={result} onRollback={setResult} />
            <SchemaReviewPanel schemaId={result.schema_id} />
            <CommentsPanel schemaId={result.schema_id} tables={result.schema.tables} />
          </>
        )}

        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-card/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Recent schemas</p>
            {history.map((h) => (
              <button key={h.id} type="button" className="block w-full truncate text-left text-xs text-indigo-300 hover:underline" onClick={() => loadSchema(h.id)}>
                {h.label || h.id.slice(0, 8)}
              </button>
            ))}
          </div>
        )}

        <div className="hidden min-h-[200px] flex-1 lg:block">
          <ChatRefine onSend={handleRefine} disabled={!result || loading} messages={chatMessages} />
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card/30">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex gap-1">
            {(["erd", "ddl", "tables"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition",
                  tab === t
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "erd" ? "ERD" : t === "ddl" ? "DDL" : "Tables"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tab === "erd" && (
              <button
                type="button"
                onClick={() => setCompactErd(!compactErd)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {compactErd ? "Full columns" : "Compact view"}
              </button>
            )}
            {result && (
              <>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </Button>
                <ExportMenu onExport={handleExport} />
              </>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 p-4">
          {!result && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Table2 className="mb-4 h-12 w-12 text-indigo-500/40" />
              <p className="text-lg font-medium">Ready to forge your schema</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Enter a plain English description or click Generate to try the e-commerce example.
              </p>
            </div>
          )}
          {loading && !result && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-400" />
                <p className="mt-4 text-sm text-muted-foreground">Running AI pipeline...</p>
              </div>
            </div>
          )}
          {result && tab === "erd" && (
            <ErdViewer schema={result.schema} compact={compactErd} className="h-full min-h-[400px]" />
          )}
          {result && tab === "ddl" && (
            <div className="h-full min-h-[400px] overflow-hidden rounded-xl border border-border">
              <DdlEditor value={result.ddl} language={editorLanguage(result.schema.dialect)} />
            </div>
          )}
          {result && tab === "tables" && (
            <div className="h-full flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4 bg-background/35 p-3 rounded-xl border border-border">
                <div className="pr-4">
                  <h3 className="text-sm font-semibold">Schema Visual Constructor</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isEditing ? "Visual Constructor Mode: Directly modify tables, columns, constraints and descriptors below." : "View-only Mode: Evolve via chat prompts on the left or enter visual design mode."}
                  </p>
                </div>
                {!isEditing ? (
                  <Button size="sm" onClick={startVisualEdit} className="gap-1 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0">
                    <Edit3 className="h-3.5 w-3.5" /> Switch to Visual Builder
                  </Button>
                ) : (
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={cancelVisualEdit}>Cancel</Button>
                    <Button size="sm" onClick={saveVisualEdit} disabled={loading} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-500">
                      <Save className="h-3.5 w-3.5" /> Save Version
                    </Button>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-4 p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/15">
                  <div className="flex items-center gap-2 flex-1">
                    <GitCommit className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs text-indigo-300 font-mono shrink-0">Version description:</span>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="e.g., Added order subscription metadata"
                      className="flex-1 text-xs px-2.5 py-1.5 bg-background rounded-lg border border-border outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      aria-label="Commit label / Version description"
                    />
                  </div>
                  <Button size="sm" onClick={handleAddTable} className="gap-1 text-xs py-1.5 px-3 bg-indigo-650 text-indigo-100 hover:bg-indigo-600">
                    <Plus className="h-3.5 w-3.5" /> Add New Table
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                {((isEditing ? editSchema?.tables : result.schema.tables) || []).map((table, tblIdx) => (
                  <div
                    key={table.name + "-" + tblIdx}
                    className="rounded-xl border border-border bg-background/50 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2.5 mb-3">
                      <div className="flex items-center gap-2 flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={table.name}
                            onChange={(e) => handleUpdateTableName(table.name, e.target.value)}
                            className="font-mono font-semibold text-indigo-300 bg-background px-2 py-1 text-sm border border-border/60 rounded focus:ring-1 focus:ring-indigo-500 max-w-[240px]"
                            title="Table name"
                          />
                        ) : (
                          <h4 className="font-mono font-semibold text-indigo-300">{table.name}</h4>
                        )}
                        {!isEditing && <Badge variant="outline">{(table.confidence * 100).toFixed(0)}% AI confidence</Badge>}
                      </div>
                      {isEditing && (
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1 h-7" onClick={() => handleDeleteTable(table.name)}>
                          <Trash className="h-3.5 w-3.5" /> Delete Table
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <textarea
                        value={table.comment || ""}
                        onChange={(e) => {
                          if (!editSchema) return;
                          setEditSchema({
                            ...editSchema,
                            tables: editSchema.tables.map(t => t.name === table.name ? { ...t, comment: e.target.value } : t)
                          });
                        }}
                        placeholder="Table comment / description..."
                        className="w-full text-xs bg-background px-2.5 py-1.5 rounded border border-border/45 mb-3 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    ) : (
                      table.comment && <p className="text-xs text-muted-foreground italic mb-3">{table.comment}</p>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead>
                          <tr className="text-muted-foreground font-semibold">
                            <th className="pb-2 pr-4 w-1/3">Column</th>
                            <th className="pb-2 pr-4 w-1/4">Type</th>
                            <th className="pb-2 pr-4 text-center w-12">PK</th>
                            <th className="pb-2 pr-4 text-center w-12">NN</th>
                            <th className="pb-2 pr-4 text-center w-12">UQ</th>
                            {isEditing && <th className="pb-2 text-right w-10">Remove</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {table.columns.map((col, colIdx) => (
                            <tr key={col.name + "-" + colIdx} className="border-t border-border/40 font-mono align-middle">
                              <td className="py-2 pr-4">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={col.name}
                                    onChange={(e) => handleUpdateColumn(table.name, colIdx, "name", e.target.value)}
                                    className="w-full bg-background px-2 py-1 border border-border/50 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                    aria-label={`Column name ${colIdx}`}
                                  />
                                ) : (
                                  <span className="font-medium text-foreground">{col.name}</span>
                                )}
                              </td>
                              <td className="py-2 pr-4">
                                {isEditing ? (
                                  <select
                                    value={col.type.toLowerCase()}
                                    onChange={(e) => handleUpdateColumn(table.name, colIdx, "type", e.target.value)}
                                    className="w-full bg-background px-1.5 py-1 border border-border/50 rounded text-xs text-violet-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    aria-label={`Column type ${colIdx}`}
                                  >
                                    <option value="varchar">varchar</option>
                                    <option value="int">int</option>
                                    <option value="bigint">bigint</option>
                                    <option value="text">text</option>
                                    <option value="uuid">uuid</option>
                                    <option value="timestamp">timestamp</option>
                                    <option value="bool">bool</option>
                                    <option value="decimal">decimal</option>
                                    <option value="jsonb">jsonb</option>
                                  </select>
                                ) : (
                                  <span className="text-violet-300">{col.type}</span>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-center">
                                {isEditing ? (
                                  <input
                                    type="checkbox"
                                    checked={!!col.primary_key}
                                    onChange={(e) => handleUpdateColumn(table.name, colIdx, "primary_key", e.target.checked)}
                                    className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                                    aria-label={`PK flag for ${col.name}`}
                                  />
                                ) : (
                                  col.primary_key ? <span className="text-[10px] bg-red-500/15 text-red-400 font-semibold px-1 py-0.5 rounded border border-red-500/10">PK</span> : <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-center">
                                {isEditing ? (
                                  <input
                                    type="checkbox"
                                    checked={!col.nullable}
                                    onChange={(e) => handleUpdateColumn(table.name, colIdx, "nullable", !e.target.checked)}
                                    className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                                    aria-label={`NN flag for ${col.name}`}
                                  />
                                ) : (
                                  !col.nullable ? <span className="text-[10px] bg-blue-500/15 text-blue-400 font-semibold px-1 py-0.5 rounded border border-blue-500/10 font-sans">NN</span> : <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-center">
                                {isEditing ? (
                                  <input
                                    type="checkbox"
                                    checked={!!col.unique}
                                    onChange={(e) => handleUpdateColumn(table.name, colIdx, "unique", e.target.checked)}
                                    className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                                    aria-label={`UQ flag for ${col.name}`}
                                  />
                                ) : (
                                  col.unique ? <span className="text-[10px] bg-amber-500/15 text-amber-400 font-semibold px-1 py-0.5 rounded border border-amber-500/10">UQ</span> : <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                              {isEditing && (
                                <td className="py-2 text-right">
                                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-450 p-1 h-7 w-7" onClick={() => handleDeleteColumn(table.name, colIdx)}>
                                    <Trash className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {isEditing && (
                      <div className="flex gap-2 mt-4 pt-2.5 border-t border-border/30">
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleAddColumn(table.name)}>
                          <Plus className="h-3 w-3" /> Add Column
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="lg:hidden">
        <ChatRefine onSend={handleRefine} disabled={!result || loading} messages={chatMessages} />
      </div>

      {compareOpen && compareSql && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCompareOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Dialect Comparison</h3>
            {Object.entries(compareSql).map(([d, sql]) => (
              <div key={d} className="mb-4">
                <p className="text-sm font-mono text-indigo-400 mb-1">{d}</p>
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto max-h-32">{sql.slice(0, 800)}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function DialectSelect({
  value,
  onChange,
}: {
  value: Dialect;
  onChange: (d: Dialect) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = DIALECTS.find((d) => d.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 min-w-[130px] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm"
      >
        {current?.label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-xl">
          {DIALECTS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => {
                onChange(d.value);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-accent"
            >
              <span className="block text-sm">{d.label}</span>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                {d.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function editorLanguage(dialect: Dialect) {
  if (dialect === "mongodb") return "javascript";
  if (dialect === "dynamodb") return "json";
  return "sql";
}

function ExportMenu({ onExport }: { onExport: (format: string) => void }) {
  const [open, setOpen] = useState(false);
  const formats = [
    { id: "ddl", label: "DDL (SQL)" },
    { id: "prisma", label: "Prisma" },
    { id: "sqlalchemy", label: "SQLAlchemy" },
    { id: "typeorm", label: "TypeORM" },
    { id: "django", label: "Django" },
    { id: "dbml", label: "DBML" },
    { id: "mermaid", label: "Mermaid ERD" },
    { id: "liquibase", label: "Liquibase" },
    { id: "flyway", label: "Flyway" },
    { id: "json_schema", label: "JSON Schema" },
  ];

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} className="gap-1">
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-xl">
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onExport(f.id);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentsPanel({ schemaId, tables }: { schemaId: string; tables: { name: string }[] }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sf_author_name") || "" : ""));
  const [content, setContent] = useState("");
  const [tableCtx, setTableCtx] = useState("");
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const res = await getComments(schemaId);
      setComments(res.comments);
    } catch {}
  }, [schemaId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function postComment() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sf_author_name", author.trim());
      }
      await addComment(schemaId, author.trim() || "Anonymous", content.trim(), tableCtx || undefined);
      setContent("");
      loadComments();
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Team Discussion</h3>
          <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">{comments.length}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={loadComments} className="h-6 text-[10px]" title="Refresh discussion thread">
          Reload
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No comments posted yet. Leave feedback to start collaboration!</p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-background/50 p-2.5 text-xs border border-border/40">
              <div className="flex items-center justify-between font-medium text-foreground mb-1">
                <span className="text-indigo-300 font-mono">{c.author}</span>
                <span className="text-[9px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {c.table_name && (
                <span className="inline-block mb-1 text-[9px] bg-violet-500/10 text-violet-400 px-1 py-0.1 select-none font-mono rounded border border-violet-500/10">
                  @{c.table_name}
                </span>
              )}
              <p className="text-muted-foreground break-words leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/65 pt-2.5 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-1/2 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            aria-label="Author name"
          />
          <select
            value={tableCtx}
            onChange={(e) => setTableCtx(e.target.value)}
            className="w-1/2 rounded-md border border-border bg-background px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-muted-foreground"
            aria-label="Select table context"
          >
            <option value="">(global focus)</option>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                @{t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <textarea
            placeholder="Type comment or feedback..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            aria-label="Comment content"
          />
          <Button size="sm" onClick={postComment} disabled={loading || !content.trim()} className="px-3 self-end h-7 text-xs bg-emerald-600 hover:bg-emerald-500">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
