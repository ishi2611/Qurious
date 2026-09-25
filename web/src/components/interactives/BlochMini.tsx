import type { BlochVector } from "@/lib/quantum";

/**
 * Compact 2D Bloch-vector view for one qubit (side view: x across, z up).
 * The arrow's length shows purity: a qubit entangled with others has a shorter arrow,
 * all the way down to a dot for a maximally entangled qubit.
 */
export default function BlochMini({
  vector,
  label,
}: {
  vector: BlochVector;
  label: string;
}) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  const r = 34;
  const cx = 44;
  const cy = 44;
  const tipX = cx + vector.x * r;
  const tipY = cy - vector.z * r;
  const description =
    length < 0.02
      ? `${label}: no arrow. This qubit has no state of its own (it's entangled).`
      : `${label}: arrow length ${length.toFixed(2)}, ${Math.round(((1 + vector.z) / 2) * 100)}% chance of reading 0.`;

  return (
    <figure className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 88 88"
        className="h-22 w-22"
        role="img"
        aria-label={description}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <line
          x1={cx - r}
          y1={cy}
          x2={cx + r}
          y2={cy}
          stroke="var(--border)"
          strokeDasharray="2 3"
        />
        <line
          x1={cx}
          y1={cy - r}
          x2={cx}
          y2={cy + r}
          stroke="var(--border)"
          strokeDasharray="2 3"
        />
        <text
          x={cx}
          y={8}
          textAnchor="middle"
          fontSize="8"
          fill="var(--zero)"
          fontFamily="var(--font-mono)"
        >
          |0⟩
        </text>
        <text
          x={cx}
          y={87}
          textAnchor="middle"
          fontSize="8"
          fill="var(--one)"
          fontFamily="var(--font-mono)"
        >
          |1⟩
        </text>
        {length < 0.02 ? (
          <circle cx={cx} cy={cy} r={3} fill="var(--accent)" />
        ) : (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={tipX}
              y2={tipY}
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={tipX} cy={tipY} r={3.5} fill="var(--accent)" />
          </>
        )}
      </svg>
      <figcaption className="text-ink-muted font-mono text-xs">
        {label}
      </figcaption>
    </figure>
  );
}
