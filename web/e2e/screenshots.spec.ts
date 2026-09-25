import path from "node:path";
import { test } from "@playwright/test";

// Regenerates the README screenshots. Skipped unless SCREENSHOTS=1:
//   SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=desktop
test.skip(
  !process.env.SCREENSHOTS,
  "set SCREENSHOTS=1 to regenerate docs/screenshots",
);

const OUT = path.resolve(__dirname, "../../docs/screenshots");

test("capture README screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  const shot = (name: string) =>
    page.screenshot({ path: `${OUT}/${name}.png` });

  await page.goto("/");
  await shot("home");

  await page.goto("/q/entanglement_ftl");
  await page.getByText(/To really understand this/).waitFor();
  await shot("preview");
  await page.getByRole("button", { name: /start from the beginning/ }).click();
  await page
    .getByText(/steps from your answer/)
    .first()
    .waitFor();
  await page.waitForTimeout(600);
  await shot("path-map");

  await page.goto("/learn/superposition");
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "H", exact: true }).click();
  await page.waitForTimeout(1200);
  await shot("bloch-sphere");

  await page.goto("/learn/bell_states");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Continue" }).click();
  const gates = page.getByRole("toolbar", { name: "Gates" });
  for (const [g, q] of [
    ["X", 1],
    ["H", 0],
    ["CNOT", 0],
  ] as const) {
    await gates.getByRole("button", { name: new RegExp(`^${g}`) }).click();
    await page.getByRole("button", { name: `Place ${g} on q${q}` }).click();
  }
  await page.getByRole("button", { name: "Check my circuit" }).click();
  await shot("circuit-puzzle");

  await page.goto("/translator");
  await page.getByRole("button", { name: "Half adder" }).click();
  await page
    .getByRole("button", { name: "Next: can it run backwards?" })
    .click();
  await page
    .getByRole("button", { name: "Make it reversible", exact: true })
    .click();
  await shot("translator");

  await page.evaluate(() => localStorage.setItem("qurious.theme", "dark"));
  await page.goto("/learn/no_signaling");
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Continue" }).click();
  for (const choice of ["measure 0/1", "measure +/−", "not measure"]) {
    await page.getByText(choice, { exact: true }).click();
    await page.getByRole("button", { name: "Run 50 pairs" }).click();
  }
  await page.getByRole("button", { name: "Compare notes with Bob" }).click();
  await shot("bell-lab-dark");
});
