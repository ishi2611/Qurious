import Ket from "./Ket";

/**
 * One horizontal bar per basis state, with the exact percentage printed.
 * For a single qubit, |0⟩ is a solid cyan bar and |1⟩ a hatched amber bar, so they differ
 * without relying on color. For several qubits, bars use the accent and the ket digits carry
 * the 0/1 colors.
 */
export default function ProbabilityBars({
  probabilities,
  numQubits,
  highlight,
  caption,
}: {
  probabilities: number[];
  numQubits: number;
  /** Basis-state index to emphasise (e.g. the last measurement result). */
  highlight?: number;
  caption?: string;
}) {
  const single = numQubits === 1;
  return (
    <figure>
      <ul className="space-y-1.5">
        {probabilities.map((p, i) => {
          const label = i.toString(2).padStart(numQubits, "0");
          const pct = Math.round(p * 1000) / 10;
          const fill = single
            ? i === 0
              ? "bg-zero"
              : "hatch-one"
            : "bg-accent";
          return (
            <li
              key={label}
              className={`grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 rounded-md ${
                highlight === i
                  ? "ring-accent ring-offset-surface ring-2 ring-offset-2"
                  : ""
              }`}
            >
              <Ket label={label} className="text-sm" />
              <div
                className="bg-surface-muted h-3 overflow-hidden rounded-full"
                role="img"
                aria-label={`${pct}% chance of reading ${label}`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${fill}`}
                  style={{ width: `${p * 100}%` }}
                />
              </div>
              <span className="text-right font-mono text-sm tabular-nums">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
      {caption && (
        <figcaption className="text-ink-muted mt-2 text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
