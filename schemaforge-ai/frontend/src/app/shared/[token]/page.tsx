"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ErdViewer } from "@/components/erd-viewer";
import { DdlEditor } from "@/components/ddl-editor";
import type { SchemaAST } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function SharedSchemaPage() {
  const { token } = useParams();
  const [schema, setSchema] = useState<SchemaAST | null>(null);
  const [ddl, setDdl] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/v1/shared/${token}`)
      .then((r) => r.json())
      .then((d) => {
        setSchema(d.schema);
        setDdl(d.ddl);
      })
      .catch(() => {});
  }, [token]);

  if (!schema) {
    return <div className="p-12 text-center text-muted-foreground">Loading shared schema...</div>;
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Shared Schema (view only)</h1>
      <div className="h-[400px] rounded-xl border border-border">
        <ErdViewer schema={schema} className="h-full" />
      </div>
      <div className="h-64 rounded-xl border border-border overflow-hidden">
        <DdlEditor value={ddl} />
      </div>
    </main>
  );
}
