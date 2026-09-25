import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import AccountMenu from "./account/AccountMenu";

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <ellipse
          cx="16"
          cy="16"
          rx="13"
          ry="4.5"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <line
          x1="16"
          y1="16"
          x2="23"
          y2="7"
          stroke="var(--one)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="2.5" fill="var(--zero)" />
      </svg>
      Qurious
    </span>
  );
}

export default function SiteHeader() {
  return (
    <header className="border-border bg-surface/80 border-b backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6"
      >
        <Link href="/" className="rounded-md" aria-label="Qurious home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/"
            className="text-ink-muted hover:text-ink hidden rounded-md px-2 py-1 text-sm sm:inline"
          >
            Questions
          </Link>
          <Link
            href="/translator"
            className="text-ink-muted hover:text-ink hidden rounded-md px-2 py-1 text-sm sm:inline"
          >
            Translator
          </Link>
          <AccountMenu />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
