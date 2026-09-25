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

const STOPS_PER_ROW = 4;
const COL_WIDTH = 150;
const ROW_HEIGHT = 104;
const PHONE_ROW_HEIGHT = 60;
const DOT = 32; // stop circle size in px

/** Handles sit on the edge of the stop's circle (not the label box), so the track runs
 * continuously from dot to dot. */
function Handles({ vertical }: { vertical: boolean }) {
  const hidden = { opacity: 0 };
  const x = vertical ? DOT / 2 : undefined; // phone: circle is on the left
  return (
    <>
      <Handle
        id="t"
        type="target"
        position={Position.Top}
        style={{ ...hidden, left: x, top: 0 }}
      />
      <Handle
        id="b"
        type="source"
        position={Position.Bottom}
        style={{ ...hidden, left: x, top: DOT, bottom: "auto" }}
      />
      {!vertical && (
        <>
          <Handle
            id="tl"
            type="target"
            position={Position.Left}
            style={{
              ...hidden,
              top: DOT / 2,
              left: `calc(50% - ${DOT / 2}px)`,
            }}
          />
          <Handle
            id="tr"
            type="target"
            position={Position.Right}
            style={{
              ...hidden,
              top: DOT / 2,
              right: `calc(50% - ${DOT / 2}px)`,
              left: "auto",
            }}
          />
          <Handle
            id="sl"
            type="source"
            position={Position.Left}
            style={{
              ...hidden,
              top: DOT / 2,
              left: `calc(50% - ${DOT / 2}px)`,
            }}
          />
          <Handle
            id="sr"
            type="source"
            position={Position.Right}
            style={{
              ...hidden,
              top: DOT / 2,
              right: `calc(50% - ${DOT / 2}px)`,
              left: "auto",
            }}
          />
        </>
      )}
    </>
  );
}

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
      className={
        vertical
          ? "flex w-64 items-center gap-3"
          : "flex w-32 flex-col items-center gap-1.5 text-center"
      }
    >
      <Handles vertical={vertical} />
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${ring}`}
        style={{ width: DOT, height: DOT }}
        aria-hidden="true"
      >
        {isGoal ? "⚑" : status === "done" ? "✓" : ""}
      </span>
      <span
        className={`text-xs leading-tight ${status === "current" ? "text-ink font-semibold" : "text-ink-muted"}`}
      >
        {title}
      </span>
    </div>
  );
}

const nodeTypes = { stop: StopNode };

/**
 * Subway-style map of the path. On wide screens the line snakes across rows of four (left to
 * right, then right to left); on phones it runs straight down. Done stops are filled, the
 * current stop is ringed, and the goal is a flag. A plain ordered list carries the same
 * information for screen readers.
 */
export default function PathMap({
  stops,
  vertical = false,
}: {
  stops: MapStop[];
  vertical?: boolean;
}) {
  const perRow = vertical ? 1 : STOPS_PER_ROW;
  const rows = Math.ceil(stops.length / perRow);
  const rowHeight = vertical ? PHONE_ROW_HEIGHT : ROW_HEIGHT;

  const { nodes, edges } = useMemo(() => {
    const place = (i: number) => {
      const row = Math.floor(i / perRow);
      const inRow = i % perRow;
      const col = row % 2 === 0 ? inRow : perRow - 1 - inRow; // boustrophedon
      return { row, col };
    };
    const nodes: Node<StopData>[] = stops.map((s, i) => {
      const { row, col } = place(i);
      return {
        id: s.id,
        type: "stop",
        position: { x: col * COL_WIDTH, y: row * rowHeight },
        data: { ...s, vertical },
        draggable: false,
        selectable: false,
        focusable: false,
      };
    });
    const edges: Edge[] = stops.slice(1).map((s, k) => {
      const a = place(k);
      const b = place(k + 1);
      const sameRow = a.row === b.row;
      const rightward = b.col > a.col;
      return {
        id: `${stops[k].id}-${s.id}`,
        source: stops[k].id,
        target: s.id,
        sourceHandle: sameRow ? (rightward ? "sr" : "sl") : "b",
        targetHandle: sameRow ? (rightward ? "tl" : "tr") : "t",
        type: "straight",
        style: {
          stroke:
            stops[k].status === "done" ? "var(--accent)" : "var(--border)",
          strokeWidth: 4,
        },
      };
    });
    return { nodes, edges };
  }, [stops, vertical, perRow, rowHeight]);

  const done = stops.filter((s) => s.status === "done").length;

  return (
    <figure>
      <div
        className="border-border bg-surface w-full overflow-hidden rounded-xl border"
        style={{ height: rows * rowHeight + (vertical ? 40 : 56) }}
        // `inert` (not just aria-hidden) also takes React Flow's links and controls out of the
        // tab order; screen readers get the list in the figcaption instead.
        inert
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
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
