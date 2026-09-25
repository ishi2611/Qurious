import { expect, test } from "@playwright/test";

test("the tutor answers from the lessons and admits what isn't covered", async ({ page }) => {
  await page.goto("/learn/measurement");
  await page.getByRole("button", { name: "Ask about this step" }).click();
  const input = page.getByLabel("Your question about this step");

  await input.fill("Why do I get the same answer when I measure twice?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/^From:/)).toBeVisible({ timeout: 30_000 });

  await input.fill("How does Grover search work?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/doesn't have a lesson on yet/)).toBeVisible({ timeout: 30_000 });
});
