import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConcepts, getQuestion, getQuestions } from "@/lib/content/server";
import { conceptsForTargets, prereqMap } from "@/lib/content/graph";
import Journey from "@/components/journey/Journey";

export function generateStaticParams() {
  return getQuestions()
    .filter((q) => q.enabled)
    .map((q) => ({ questionId: q.id }));
}

// Only enabled questions have pages; anything else is a 404.
export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/q/[questionId]">,
): Promise<Metadata> {
  const { questionId } = await props.params;
  return { title: getQuestion(questionId)?.question };
}

export default async function QuestionPage(
  props: PageProps<"/q/[questionId]">,
) {
  const { questionId } = await props.params;
  const question = getQuestion(questionId);
  if (!question?.enabled) notFound();

  const all = getConcepts();
  const ids = conceptsForTargets(question.targets, all);
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
