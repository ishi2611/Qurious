import Callout from "@/components/ui/Callout";
import Ket from "@/components/ui/Ket";
import MathBlock from "@/components/ui/MathBlock";
import ProbabilityBars from "@/components/ui/ProbabilityBars";
import { Button } from "@/components/ui/Button";
import ApiStatus from "@/components/ApiStatus";
import DesignDemos from "./DesignDemos";

export const metadata = { title: "Design system" };

const COLORS = [
  ["bg", "Page background"],
  ["surface", "Cards and panels"],
  ["surface-muted", "Insets, math"],
  ["border", "Hairlines"],
  ["ink", "Body text"],
  ["ink-muted", "Secondary text"],
  ["accent", "Links, focus, progress"],
  ["accent-solid", "Primary buttons"],
  ["accent-soft", "Selected, 'you are here'"],
  ["zero", "Everything |0⟩"],
  ["one", "Everything |1⟩"],
  ["success", "Correct"],
  ["danger", "Not quite"],
  ["caution-soft", "Where an analogy breaks"],
];

const TYPE = [
  [
    "Display",
    "text-4xl font-semibold tracking-tight",
    "Is entanglement faster than light?",
  ],
  ["H1", "text-2xl font-semibold tracking-tight", "Superposition"],
  ["H2", "text-lg font-semibold", "Why it matters"],
  [
    "Body",
    "text-[1.0625rem] leading-relaxed",
    "A qubit's state is a pair of amplitudes. Reading it gives one bit.",
  ],
  [
    "Small",
    "text-sm text-ink-muted",
    "Chance of each result if you measured now.",
  ],
  [
    "Eyebrow",
    "text-xs font-semibold tracking-wide uppercase text-accent",
    "3 steps from your answer",
  ],
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border space-y-4 border-t pt-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-accent text-sm font-semibold tracking-wide uppercase">
          Proposed · awaiting approval
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Qurious design system
        </h1>
        <p className="text-ink-muted max-w-prose">
          The living version of docs/design-system.md. Switch the theme in the
          header to check both modes.
        </p>
        <ApiStatus />
      </header>

      <Section title="Color">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map(([token, use]) => (
            <li
              key={token}
              className="border-border bg-surface overflow-hidden rounded-xl border"
            >
              <div className="h-14" style={{ background: `var(--${token})` }} />
              <div className="p-2.5">
                <p className="font-mono text-xs font-semibold">{token}</p>
                <p className="text-ink-muted text-xs">{use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <dl className="space-y-4">
          {TYPE.map(([name, cls, sample]) => (
            <div
              key={name}
              className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-baseline"
            >
              <dt className="text-ink-muted font-mono text-xs">{name}</dt>
              <dd className={cls}>{sample}</dd>
            </div>
          ))}
          <div className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-baseline">
            <dt className="text-ink-muted font-mono text-xs">Kets</dt>
            <dd className="text-lg">
              <Ket label="0" />, <Ket label="1" />, <Ket label="01" />,{" "}
              <Ket label="ψ" />, <Ket label="+" />
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Continue</Button>
          <Button variant="secondary">Back</Button>
          <Button variant="ghost">Wait, why?</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Callouts">
        <Callout kind="analogy">
          A qubit is like a dial you can set anywhere between 0 and 1.
        </Callout>
        <Callout kind="breaks">
          You can read a dial&apos;s setting; you can&apos;t read a qubit&apos;s
          amplitudes from one copy.
        </Callout>
      </Section>

      <Section title="Probability bars">
        <div className="grid gap-6 sm:grid-cols-2">
          <ProbabilityBars
            probabilities={[0.75, 0.25]}
            numQubits={1}
            caption="One qubit: solid |0⟩, hatched |1⟩."
          />
          <ProbabilityBars
            probabilities={[0.5, 0, 0, 0.5]}
            numQubits={2}
            caption="Two qubits: digits carry the colors."
          />
        </div>
      </Section>

      <Section title="Math">
        <MathBlock
          latex={"|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle"}
          plainEnglish="Every equation has a plain-English line."
        />
      </Section>

      <DesignDemos />
    </main>
  );
}
