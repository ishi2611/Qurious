import type { Operation } from "@/lib/quantum";

const COL = 52;
const ROW = 48;
const LEFT = 64;

/** Read-only circuit drawing in standard notation (● control, ⊕ target, boxed single-qubit gates). */
export default function CircuitDiagram({
  numQubits,
  ops,
  labels,
  caption,
}: {
  numQubits: number;
  ops: Operation[];
  labels?: string[];
  caption?: string;
}) {
  const width = LEFT + (ops.length + 1) * COL;
  const height = numQubits * ROW + 8;
  const y = (q: number) => 28 + q * ROW;
  const description = `Circuit on ${numQubits} qubits: ${ops
    .map(
      (op) =>
        `${op.gate} on ${op.qubits.map((q) => labels?.[q] ?? `q${q}`).join(", ")}`,
    )
    .join("; ")}.`;

  return (
    <figure className="border-border bg-surface overflow-x-auto rounded-xl border p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={description}
        className="max-w-none"
      >
        {Array.from({ length: numQubits }, (_, q) => (
          <g key={q}>
            <text
              x={8}
              y={y(q) + 4}
              fontSize="12"
              fontFamily="var(--font-mono)"
              fill="var(--ink-muted)"
            >
              {labels?.[q] ?? `q${q}`}
            </text>
            <line
              x1={LEFT - 8}
              y1={y(q)}
              x2={width - 8}
              y2={y(q)}
              stroke="var(--ink-muted)"
              strokeOpacity="0.6"
            />
          </g>
        ))}
        {ops.map((op, i) => {
          const x = LEFT + (i + 0.5) * COL;
          if (op.qubits.length === 1) {
            return (
              <g key={i}>
                <rect
                  x={x - 15}
                  y={y(op.qubits[0]) - 15}
                  width={30}
                  height={30}
                  rx={6}
                  fill="var(--surface)"
                  stroke="var(--accent)"
                />
                <text
                  x={x}
                  y={y(op.qubits[0]) + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  fill="var(--ink)"
                >
                  {op.gate}
                </text>
              </g>
            );
          }
          const target = op.qubits[op.qubits.length - 1];
          const controls = op.qubits.slice(0, -1);
          const top = Math.min(...op.qubits);
          const bottom = Math.max(...op.qubits);
          return (
            <g key={i} stroke="var(--accent)" fill="var(--accent)">
              <line x1={x} y1={y(top)} x2={x} y2={y(bottom)} strokeWidth={2} />
              {controls.map((c) => (
                <circle key={c} cx={x} cy={y(c)} r={5} />
              ))}
              <circle
                cx={x}
                cy={y(target)}
                r={10}
                fill="var(--surface)"
                strokeWidth={2}
              />
              <line
                x1={x - 10}
                y1={y(target)}
                x2={x + 10}
                y2={y(target)}
                strokeWidth={2}
              />
              <line
                x1={x}
                y1={y(target) - 10}
                x2={x}
                y2={y(target) + 10}
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>
      {caption && (
        <figcaption className="text-ink-muted px-2 pt-1 text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
