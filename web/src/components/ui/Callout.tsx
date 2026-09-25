import type { ReactNode } from "react";

type Kind = "analogy" | "breaks" | "note";

const STYLES: Record<Kind, { box: string; title: string; icon: string }> = {
  analogy: {
    box: "bg-accent-soft text-ink",
    title: "An analogy",
    icon: "💡",
  },
  breaks: {
    box: "bg-caution-soft text-caution-ink",
    title: "Where this analogy breaks",
    icon: "⚠️",
  },
  note: { box: "bg-surface-muted text-ink", title: "Note", icon: "ℹ️" },
};

/** Highlighted box for analogies, "where it breaks" notes and asides. */
export default function Callout({
  kind,
  title,
  children,
}: {
  kind: Kind;
  title?: string;
  children: ReactNode;
}) {
  const style = STYLES[kind];
  return (
    <aside className={`rounded-xl p-4 sm:p-5 ${style.box}`}>
      <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden="true">{style.icon}</span>
        {title ?? style.title}
      </p>
      <div className="leading-relaxed">{children}</div>
    </aside>
  );
}
