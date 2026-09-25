import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <p className="text-accent text-sm font-semibold tracking-wide uppercase">
        Page not found
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        This page isn&apos;t in superposition. It just doesn&apos;t exist.
      </h1>
      <p className="text-ink-muted text-lg">
        The link may be old, or that lesson hasn&apos;t been written yet.
      </p>
      <Link href="/" className={buttonClass("primary", "self-start")}>
        Back to the questions
      </Link>
    </main>
  );
}
