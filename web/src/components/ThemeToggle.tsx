"use client";

import { useEffect, useState } from "react";
import { applyTheme, readThemeChoice, ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "◐" },
];

export default function ThemeToggle() {
  // Start from the server default and sync after mount: the <html> attribute was already set
  // by the inline script, so this only affects which button looks pressed.
  const [choice, setChoice] = useState<ThemeChoice>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from storage
    setChoice(readThemeChoice());
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme("system");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [choice]);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="border-border bg-surface flex rounded-lg border p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          title={o.label}
          onClick={() => {
            setChoice(o.value);
            applyTheme(o.value);
          }}
          className={`flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm transition-colors ${
            choice === o.value
              ? "bg-accent-soft text-accent"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <span aria-hidden="true">{o.icon}</span>
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
