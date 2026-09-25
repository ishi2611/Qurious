import { expect, test } from "@playwright/test";

const API = "http://localhost:8100";
const TOKEN = "e2e-admin-token";

// Needs a web build with NEXT_PUBLIC_STUDY_MODE=true and an API with STUDY_ENABLED=true and
// STUDY_ADMIN_TOKEN=e2e-admin-token (see playwright.config.ts).
test("a full study session can be run and exported", async ({
  page,
  request,
}) => {
  await page.goto("/study");
  await page.getByLabel("Study code (if you were given one)").fill("e2e");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join the study" }).click();

  // Pre-test: answer every item (the first option; correctness doesn't matter here).
  await expect(page.getByText("Before you start: a short quiz")).toBeVisible();
  for (;;) {
    await page
      .locator("label")
      .filter({ has: page.getByRole("radio") })
      .first()
      .click();
    const finish = page.getByRole("button", { name: "Finish" });
    if (await finish.isVisible()) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: "Next" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "Now, learn something" }),
  ).toBeVisible();
  const banner = page.getByText(/your research id is/);
  await expect(banner).toBeVisible();
  const participantId = (await banner.locator("span").innerText()).trim();
  expect(participantId).toMatch(/^P-[A-Z0-9]{8}$/);

  // Learn a little: open a lesson and move through a couple of steps.
  await page.goto("/learn/qubit");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(6000); // one batch flush

  // Post-test.
  await page.getByRole("link", { name: /take the final quiz/ }).click();
  await page.getByRole("button", { name: /take the final quiz/ }).click();
  for (;;) {
    await page
      .locator("label")
      .filter({ has: page.getByRole("radio") })
      .first()
      .click();
    const finish = page.getByRole("button", { name: "Finish" });
    if (await finish.isVisible()) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();

  // The researcher's export contains this participant, with scores and events.
  const csv = await (
    await request.get(`${API}/study/export/summary.csv`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
  ).text();
  const line = csv.split("\n").find((l) => l.startsWith(participantId));
  expect(line, "participant missing from export").toBeTruthy();
  const header = csv.split("\n")[0].split(",");
  const row = Object.fromEntries(
    line!.split(",").map((v, i) => [header[i], v]),
  );
  expect(Number(row.pre_answered)).toBeGreaterThan(0);
  expect(Number(row.post_answered)).toBe(Number(row.pre_answered));
  expect(row.study_code).toBe("e2e");
  expect(row.last_concept).toBe("qubit");

  // Withdraw: everything is deleted.
  await page.getByRole("button", { name: "Withdraw from the study" }).click();
  await page.getByRole("button", { name: "Yes, delete my data" }).click();
  const after = await (
    await request.get(`${API}/study/export/participants.csv`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
  ).text();
  expect(after).not.toContain(participantId);
});
