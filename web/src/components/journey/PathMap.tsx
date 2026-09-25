"use client";

import { useMemo } from "react";
import {
  Background,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// A type alias (not an interface) so it satisfies React Flow's Record<string, unknown> data constraint.
export type MapStop = {
  id: string;
  title: string;
  status: "done" | "current" | "todo";
  isGoal?: boolean;
};

type StopData = MapStop & { vertical: boolean };

function StopNode({ data }: NodeProps<Node<StopData>>) {
  const { title, status, isGoal, vertical } = data;
  const ring =
    status === "done"
      ? "border-accent bg-accent text-white"
      : status === "current"
        ? "border-accent bg-accent-soft text-accent ring-4 ring-accent/25"
        : "border-ink-muted/50 bg-surface text-ink-muted";
  return (
    <div
      className={`flex items-center gap-2 ${vertical ? "flex-row" : "w-28 flex-col text-center"}`}
    >
      <Handle
        type="target"
        position={vertical ? Position.Top : Position.Left}
        className="!opacity-0"
      />
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${ring}`}
        aria-hidden="true"
      >
        {isGoal ? "⚑" : status === "done" ? "✓" : ""}
      </span>
      <span
        className={`text-xs leading-tight ${status === "current" ? "text-ink font-semibold" : "text-ink-muted"}`}
      >
        {title}
      </span>
      <Handle
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        className="!opacity-0"
      />
    </div>
  );
}

const nodeTypes = { stop: StopNode };

/**
 * Subway-style map of the path: done stops filled, the current stop ringed, the goal as a flag.
 * A plain ordered list carries the same information for screen readers.
 */
export default function PathMap({
  stops,
  vertical = false,
}: {
  stops: MapStop[];
  vertical?: boolean;
}) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<StopData>[] = stops.map((s, i) => ({
      id: s.id,
      type: "stop",
      position: vertical
        ? { x: 0, y: i * 64 }
        : { x: i * 124, y: (i % 2) * 36 },
      data: { ...s, vertical },
      draggable: false,
      selectable: false,
      focusable: false,
    }));
    const edges: Edge[] = stops.slice(1).map((s, i) => ({
      id: `${stops[i].id}-${s.id}`,
      source: stops[i].id,
      target: s.id,
      type: "straight",
      style: {
        stroke: stops[i].status === "done" ? "var(--accent)" : "var(--border)",
        strokeWidth: 3,
      },
    }));
    return { nodes, edges };
  }, [stops, vertical]);

  const done = stops.filter((s) => s.status === "done").length;

  return (
    <figure>
      <div
        className="border-border bg-surface w-full overflow-hidden rounded-xl border"
        style={{
          height: vertical ? Math.max(160, stops.length * 64 + 32) : 180,
        }}
        aria-hidden="true"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={!vertical}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
        >
          <Background gap={24} size={1} color="var(--border)" />
        </ReactFlow>
      </div>
      <figcaption className="sr-only">
        <p>
          Your path: {done} of {stops.length} steps done.
        </p>
        <ol>
          {stops.map((s) => (
            <li key={s.id}>
              {s.title}:{" "}
              {s.status === "done"
                ? "done"
                : s.status === "current"
                  ? "you are here"
                  : "to do"}
              {s.isGoal ? " (your answer)" : ""}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
