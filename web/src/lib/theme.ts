export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "qurious.theme";

/**
 * Runs in <head> before first paint: resolves the saved choice (default "light") to light or
 * dark and sets data-theme on <html>. Kept as a string so it can be inlined.
 */
export const THEME_BOOTSTRAP = `(function(){try{var c=localStorage.getItem("${THEME_KEY}")||"light";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

/** Apply a choice to <html> and remember it. */
export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}
