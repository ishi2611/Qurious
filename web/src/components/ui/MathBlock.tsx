import katex from "katex";
import { WithKets } from "./Ket";

/** Display equation rendered with KaTeX, followed by its required plain-English line. */
export default function MathBlock({
  latex,
  plainEnglish,
}: {
  latex: string;
  plainEnglish: string;
}) {
  // Content is validated with the same KaTeX settings (npm run content:math), so this won't
  // throw for authored lessons; throwOnError: false is a last-resort guard that shows the
  // source in red instead of crashing the page.
  const html = katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    output: "htmlAndMathml", // MathML is read by screen readers
  });
  return (
    <figure className="bg-surface-muted rounded-xl px-4 py-3">
      <div
        className="overflow-x-auto overflow-y-hidden"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <figcaption className="text-ink-muted mt-1 text-[0.95rem] leading-relaxed">
        <WithKets text={plainEnglish} />
      </figcaption>
    </figure>
  );
}
