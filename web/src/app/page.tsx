import Link from "next/link";
import { getConcepts, getQuestions } from "@/lib/content/server";
import { conceptsForTargets } from "@/lib/content/graph";
import FreeTextQuestion from "@/components/tutor/FreeTextQuestion";

export default function Home() {
  const concepts = getConcepts();
  // Playable questions first, then "coming soon", each in authored order.
  const questions = [...getQuestions()]
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.order - b.order)
    .map((q) => {
      const ids = conceptsForTargets(q.targets, concepts);
      return {
        ...q,
        ideas: ids.length,
        minutes: ids.reduce((s, id) => s + concepts[id].estimated_minutes, 0),
      };
    });
  const freeTextEnabled = process.env.NEXT_PUBLIC_FEATURE_FREE_TEXT === "true";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="max-w-2xl space-y-4">
        <p className="text-accent text-sm font-semibold tracking-wide uppercase">
          Learn quantum computing backwards
        </p>
        <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
          What are you curious about?
        </h1>
        <p className="text-ink-muted text-lg leading-relaxed">
          Pick a question. Qurious works out which ideas it depends on, skips
          the ones you already know, and teaches only the path to your answer,
          with visuals you can play with and short puzzles along the way.
        </p>
      </section>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Questions">
        {questions.map((q) => (
          <li key={q.id}>
            {q.enabled ? (
              <Link
                href={`/q/${q.id}`}
                className="group border-border bg-surface shadow-card hover:border-accent flex h-full flex-col justify-between gap-6 rounded-2xl border p-5 transition-colors sm:p-6"
              >
                <h2 className="group-hover:text-accent text-xl leading-snug font-semibold tracking-tight">
                  {q.question}
                </h2>
                <p className="text-ink-muted flex items-center justify-between text-sm">
                  <span>
                    Up to {q.ideas} ideas · about {q.minutes} min
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-accent text-lg transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </p>
              </Link>
            ) : (
              <div className="border-border flex h-full flex-col justify-between gap-6 rounded-2xl border border-dashed p-5 sm:p-6">
                <h2 className="text-ink-muted text-xl leading-snug font-semibold tracking-tight">
                  {q.question}
                </h2>
                <p className="text-ink-muted text-sm">
                  Coming soon · lessons in progress
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {freeTextEnabled && (
        <section className="mt-12 max-w-2xl">
          <FreeTextQuestion />
        </section>
      )}

      <section className="border-border mt-16 grid gap-6 border-t pt-10 sm:grid-cols-3">
        {[
          [
            "Start from a question",
            "Not from chapter one. Your curiosity sets the destination.",
          ],
          [
            "Skip what you know",
            "A quick check at the start removes ideas you've already got.",
          ],
          [
            "Learn by doing",
            "Every step has something to play with and a short check at the end.",
          ],
        ].map(([title, text]) => (
          <div key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-ink-muted mt-1 text-[0.95rem] leading-relaxed">
              {text}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
