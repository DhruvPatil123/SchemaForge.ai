"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { SchemaAST } from "@/lib/api";
import { cn } from "@/lib/utils";

const REL_COLORS: Record<string, string> = {
  one_to_one: "#6366f1",
  one_to_many: "#22d3ee",
  many_to_one: "#22d3ee",
  many_to_many: "#f59e0b",
};

function TableNode({ data }: { data: { label: string; columns: string[]; compact: boolean } }) {
  return (
    <div className="min-w-[200px] rounded-xl border border-indigo-500/30 bg-card/95 shadow-xl backdrop-blur relative">
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-2 !h-2" />
      <div className="rounded-t-xl bg-gradient-to-r from-indigo-600/80 to-violet-600/80 px-3 py-2">
        <p className="font-mono text-sm font-semibold text-white">{data.label}</p>
      </div>
      <div className="max-h-48 overflow-y-auto px-2 py-2">
        {(data.compact ? data.columns.slice(0, 4) : data.columns).map((col) => (
          <div
            key={col}
            className="border-b border-border/50 px-1 py-1 font-mono text-[11px] text-muted-foreground last:border-0"
          >
            {col}
          </div>
        ))}
        {data.compact && data.columns.length > 4 && (
          <p className="px-1 py-1 text-[10px] text-muted-foreground">
            +{data.columns.length - 4} more columns
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { table: TableNode };

function layoutNodes(schema: SchemaAST, compact: boolean): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  const nodes: Node[] = schema.tables.map((table) => {
    const colLabels = table.columns.map((c) => {
      const flags = [
        c.primary_key ? "PK" : null,
        c.unique && !c.primary_key ? "UQ" : null,
        !c.nullable ? "NN" : null,
      ].filter(Boolean);
      return `${c.name}: ${c.type}${flags.length ? ` [${flags.join(",")}]` : ""}`;
    });
    g.setNode(table.name, { width: 220, height: Math.min(80 + colLabels.length * 22, 280) });
    return {
      id: table.name,
      type: "table",
      position: { x: 0, y: 0 },
      data: { label: table.name, columns: colLabels, compact },
    };
  });

  const edges: Edge[] = schema.relationships.map((rel, i) => {
    g.setEdge(rel.from_table, rel.to_table);
    const color = REL_COLORS[rel.relationship_type] || "#6366f1";
    return {
      id: `e-${i}`,
      source: rel.from_table,
      target: rel.to_table,
      label: rel.relationship_type.replace(/_/g, ":"),
      labelStyle: { fill: color, fontSize: 10, fontWeight: 600 },
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
      animated: rel.relationship_type === "many_to_many",
    };
  });

  dagre.layout(g);
  nodes.forEach((node) => {
    const pos = g.node(node.id);
    node.position = { x: pos.x - 110, y: pos.y - 40 };
  });

  return { nodes, edges };
}

interface ErdViewerProps {
  schema: SchemaAST | null;
  compact?: boolean;
  className?: string;
}

export function ErdViewer({ schema, compact = false, className }: ErdViewerProps) {
  const layout = useMemo(
    () => (schema ? layoutNodes(schema, compact) : { nodes: [], edges: [] }),
    [schema, compact]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  const onInit = useCallback(() => {}, []);

  if (!schema) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">Generate a schema to view the ERD</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full rounded-xl border border-border bg-[#0a0a12]", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e1e2e" gap={20} />
        <Controls className="!bg-card !border-border" />
        <MiniMap
          nodeColor="#6366f1"
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-card/80"
        />
      </ReactFlow>
    </div>
  );
}
