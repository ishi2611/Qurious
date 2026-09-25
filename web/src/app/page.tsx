import ApiStatus from "@/components/ApiStatus";

// Placeholder home page for M0. The real home (question cards) arrives in M5,
// after the design system is agreed in M3.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Qurious</h1>
      <p className="text-lg text-zinc-700 dark:text-zinc-300">
        Start from a question you&apos;re curious about. Learn only what you
        need to answer it.
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Coming soon.</p>
      <ApiStatus />
    </main>
  );
}
