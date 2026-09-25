import AxeBuilder from "@axe-core/playwright";
import { expect, Page, test } from "@playwright/test";

/** Run axe (WCAG 2.x A and AA rules) and fail with a readable list of violations. */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${label}: ${v.id} (${v.impact}) ${v.help} → ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (t) => localStorage.setItem("qurious.theme", t),
        theme,
      );
    });

    for (const [path, name] of [
      ["/", "home"],
      ["/q/entanglement_ftl", "question preview"],
      ["/translator", "translator"],
      ["/playground", "playground"],
      ["/design", "design system"],
      ["/study", "study"],
      ["/does-not-exist", "404"],
    ]) {
      test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("load");
        await audit(page, name);
      });
    }

    test("every section of a lesson has no WCAG A/AA violations", async ({
      page,
    }) => {
      await page.goto("/learn/entanglement");
      for (const section of [
        "hook",
        "intuition",
        "interactive",
        "math",
        "puzzle",
      ]) {
        await page.waitForTimeout(700); // let the screen transition (exit + enter) finish
        await audit(page, `lesson ${section}`);
        await page
          .getByRole("button", { name: /^(Continue|Skip puzzle)$/ })
          .click();
      }
      await page.waitForTimeout(700);
      await audit(page, "lesson check");
    });

    test("the Bloch sphere and path map have no WCAG A/AA violations", async ({
      page,
    }) => {
      await page.goto("/learn/bloch_sphere");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(800);
      await audit(page, "bloch sphere");
      await page.goto("/q/entanglement_ftl");
      await page
        .getByRole("button", { name: /start from the beginning/ })
        .click();
      await expect(
        page.getByText(/steps from your answer/).first(),
      ).toBeVisible();
      await audit(page, "path map");
    });
  });
}
