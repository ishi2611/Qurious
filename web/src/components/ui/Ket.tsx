/**
 * A ket like |0⟩ or |01⟩ in monospace. Each binary digit takes its semantic color
 * (0 → cyan, 1 → amber), so qubit values look the same everywhere in the app.
 * Non-binary labels (ψ, +, −) use the normal text color.
 */
export default function Ket({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const binary = /^[01]+$/.test(label);
  return (
    <span className={`font-mono whitespace-nowrap ${className}`}>
      |
      {binary
        ? [...label].map((digit, i) => (
            <span
              key={i}
              className={
                digit === "0"
                  ? "text-zero font-semibold"
                  : "text-one font-semibold"
              }
            >
              {digit}
            </span>
          ))
        : label}
      ⟩
    </span>
  );
}

/** Replace every |…⟩ in a plain string with a styled <Ket>. */
export function WithKets({ text }: { text: string }) {
  const parts = text.split(/(\|[^|⟩\s]{1,6}⟩)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\|[^|⟩\s]{1,6}⟩$/.test(part) ? (
          <Ket key={i} label={part.slice(1, -1)} />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
