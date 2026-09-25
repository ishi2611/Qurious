import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConcept, getConcepts } from "@/lib/content/server";
import { conceptsForTargets } from "@/lib/content/graph";
import StandaloneLesson from "@/components/lesson/StandaloneLesson";

export function generateStaticParams() {
  return Object.values(getConcepts())
    .filter((c) => c.status !== "stub")
    .map((c) => ({ conceptId: c.id }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/learn/[conceptId]">,
): Promise<Metadata> {
  const { conceptId } = await props.params;
  return { title: getConcept(conceptId)?.title };
}

/** A single lesson on its own (used for detours from the tutor and for direct links). */
export default async function LearnPage(
  props: PageProps<"/learn/[conceptId]">,
) {
  const { conceptId } = await props.params;
  const concept = getConcept(conceptId);
  if (!concept || concept.status === "stub") notFound();

  const all = getConcepts();
  // Prerequisites (for "Wait, why?" detours) that have lessons.
  const related = conceptsForTargets([conceptId], all).filter(
    (id) => all[id].status !== "stub",
  );
  const concepts = Object.fromEntries(related.map((id) => [id, all[id]]));

  return <StandaloneLesson rootId={conceptId} concepts={concepts} />;
}
