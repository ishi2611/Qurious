import { notFound } from "next/navigation";
import { getConcepts } from "@/lib/content/server";
import { conceptsForTargets, prereqMap } from "@/lib/content/graph";
import type { Question } from "@/lib/content/types";
import Journey from "@/components/journey/Journey";

export const metadata = { title: "Your question" };

/**
 * v2 free-text journeys: the tutor's router maps a typed question onto concept ids, and this
 * page runs the same journey as a question card. Only paths made entirely of written lessons
 * are allowed, so a learner can't reach a dead end.
 */
export default async function ExplorePage(props: PageProps<"/explore">) {
  if (process.env.NEXT_PUBLIC_FEATURE_FREE_TEXT !== "true") notFound();
  const params = await props.searchParams;
  const all = getConcepts();
  const targets = String(params.targets ?? "")
    .split(",")
    .filter((id) => all[id]);
  const text = String(params.q ?? "").slice(0, 300);
  if (!targets.length) notFound();

  const ids = conceptsForTargets(targets, all);
  if (ids.some((id) => all[id].status === "stub")) notFound();

  const question: Question = {
    id: `custom-${targets.join("-")}`,
    question: text || "Your question",
    status: "draft",
    enabled: true,
    order: 0,
    preview:
      "Qurious doesn't answer typed questions directly. It found the ideas your question depends on, and the path below teaches them, so you can work out the answer yourself.",
    targets,
    reward: {
      type: "coming_soon",
      title: "You've reached your answer",
      description: "You now have every idea your question depends on.",
    },
  };
  const concepts = Object.fromEntries(ids.map((id) => [id, all[id]]));
  const titles = Object.fromEntries(
    Object.values(all).map((c) => [c.id, c.title]),
  );
  return (
    <Journey
      question={question}
      concepts={concepts}
      prereqs={prereqMap(all)}
      titles={titles}
    />
  );
}
