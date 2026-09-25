"use client";

import { useEffect, useState } from "react";

export interface ThemeColors {
  ink: string;
  inkMuted: string;
  border: string;
  accent: string;
  zero: string;
  one: string;
  surface: string;
}

const FALLBACK: ThemeColors = {
  ink: "#1c1917",
  inkMuted: "#57534e",
  border: "#e4e0da",
  accent: "#4338ca",
  zero: "#0e7490",
  one: "#b45309",
  surface: "#ffffff",
};

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ink: get("--ink", FALLBACK.ink),
    inkMuted: get("--ink-muted", FALLBACK.inkMuted),
    border: get("--border", FALLBACK.border),
    accent: get("--accent", FALLBACK.accent),
    zero: get("--zero", FALLBACK.zero),
    one: get("--one", FALLBACK.one),
    surface: get("--surface", FALLBACK.surface),
  };
}

/**
 * The current theme's colors as plain hex strings, for canvases and WebGL, which can't use
 * CSS variables. Updates when the theme changes.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the live theme once mounted
    setColors(read());
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return colors;
}
