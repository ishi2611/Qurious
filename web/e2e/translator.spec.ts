import { expect, test } from "@playwright/test";

test("translator: half adder goes from irreversible to a matching quantum circuit", async ({
  page,
}) => {
  await page.goto("/translator");
  await page.getByRole("button", { name: "Half adder" }).click();
  await page.getByRole("button", { name: "Next: can it run backwards?" }).click();
  await expect(page.getByText("It can't run backwards")).toBeVisible();
  await page.getByRole("button", { name: "Make it reversible", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /Circuit on 4 qubits/ }),
  ).toBeVisible();
  await expect(page.getByText("AND → Toffoli")).toBeVisible();
  await page.getByRole("button", { name: "Simulate it" }).click();
  await expect(page.getByText("✓ match")).toHaveCount(4);
  await page.getByRole("button", { name: "What if the input is in superposition?" }).click();
  await expect(page.getByText("25%")).toHaveCount(4);
});

test("translator: build a custom circuit from scratch", async ({ page }) => {
  await page.goto("/translator");
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.getByLabel("Gate").selectOption("OR");
  await page.getByRole("button", { name: "Add gate" }).click();
  await page.getByRole("button", { name: "Next: can it run backwards?" }).click();
  await page.getByRole("button", { name: "Make it reversible", exact: true }).click();
  await page.getByRole("button", { name: "Simulate it" }).click();
  await expect(page.getByText("✓ match")).toHaveCount(4);
});
