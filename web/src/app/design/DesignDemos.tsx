"use client";

import CheckQuestion from "@/components/lesson/CheckQuestion";
import PathMap from "@/components/journey/PathMap";

/** Interactive samples for the design page (client-only components). */
export default function DesignDemos() {
  return (
    <>
      <section className="border-border space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold tracking-tight">Check question</h2>
        <CheckQuestion
          check={{
            question:
              "You measure a qubit in |+⟩ and get 0. What is its state now?",
            options: ["Still |+⟩", "|0⟩", "|1⟩"],
            answer: 1,
            explanation:
              "A measurement leaves the qubit in the state matching its result.",
          }}
          altExplanation="Think of measurement as a sorting machine: the qubit comes out as a clean |0⟩ or |1⟩."
          onContinue={() => {}}
        />
      </section>
      <section className="border-border space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold tracking-tight">Path map</h2>
        <PathMap
          stops={[
            { id: "a", title: "The qubit", status: "done" },
            { id: "b", title: "Superposition", status: "done" },
            { id: "c", title: "Measurement", status: "current" },
            { id: "d", title: "Entanglement", status: "todo" },
            { id: "e", title: "No-signaling", status: "todo", isGoal: true },
          ]}
        />
      </section>
    </>
  );
}
