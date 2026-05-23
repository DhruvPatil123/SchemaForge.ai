"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1e1e2e]">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </div>
  ),
});

interface DdlEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
}

export function DdlEditor({ value, language = "sql", readOnly = true }: DdlEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: true },
        fontSize: 13,
        fontFamily: "var(--font-geist-mono), Consolas, monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        padding: { top: 12 },
        renderLineHighlight: "line",
      }}
    />
  );
}
