import { expect, Page, test } from "@playwright/test";
import { answerKey } from "./content";

const KEY = answerKey();

/** Answer the check currently on screen correctly. Returns the question text. */
async function answerCheck(page: Page, previous?: string): Promise<string> {
  const legend = page.locator("fieldset legend").first();
  // Screens animate out before the next one appears; wait until the new question is showing.
  if (previous) await expect(legend).not.toHaveText(previous);
  const text = (await legend.innerText()).trim();
  const answer = KEY.get(text);
  expect(answer, `no answer for "${text}"`).toBeTruthy();
  // Exact match: "50%" must not pick "Less than 50%".
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: answer!, exact: true }) })
    .click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("✓ Correct")).toBeVisible();
  return text;
}

/** Play one lesson from its first screen to its last check. */
async function playLesson(page: Page) {
  // Move through hook → intuition → interactive → math → puzzle (skipped).
  for (let i = 0; i < 6; i++) {
    const cont = page.getByRole("button", { name: /^(Continue|Skip puzzle)$/ });
    if (!(await cont.isVisible())) break;
    await cont.click();
  }
  // Answer every check question in the lesson.
  let previous: string | undefined;
  for (;;) {
    previous = await answerCheck(page, previous);
    const next = page.getByRole("button", { name: "Next question" });
    if (await next.isVisible()) {
      await next.click();
      continue;
    }
    await page
      .getByRole("button", {
        name: /^(Next step|See your answer|Back to your path)$/,
      })
      .click();
    return;
  }
}

for (const [id, question, rewardText] of [
  [
    "entanglement_ftl",
    "Is entanglement faster than light?",
    "Try to beat the speed of light",
  ],
  [
    "quantum_teleportation",
    "Is quantum teleportation real teleportation?",
    "Teleport a qubit",
  ],
] as const) {
  test(`${question} — from the card to the reward with no dead ends`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await page
      .getByRole("link", { name: new RegExp(question.replace("?", "\\?")) })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: question }),
    ).toBeVisible();
    await expect(
      page.getByText(/To really understand this you need \d+ ideas/),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /start from the beginning/ })
      .click();
    await expect(
      page.getByText(/steps from your answer/).first(),
    ).toBeVisible();

    // Every stop on the path: map → lesson → map …
    for (let stop = 0; stop < 20; stop++) {
      const start = page.getByRole("button", { name: /^(Start|Continue): / });
      if (!(await start.isVisible().catch(() => false))) break;
      await start.click();
      await playLesson(page);
    }

    await expect(
      page.getByRole("heading", { level: 1, name: rewardText }),
    ).toBeVisible();
    await expect(page.getByText("On the way to")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    void id;
  });
}

test("the quick check skips what you already know", async ({ page }) => {
  await page.goto("/q/entanglement_ftl");
  await page.getByRole("button", { name: "Start with a quick check" }).click();
  // Answer the first question (closest to the goal) correctly: that skips everything under it.
  await answerCheck(page);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Show my path" }).click();
  await expect(
    page.getByText(/skipping 1 idea you already know/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /One step from your answer|2 steps from your answer/,
  );
});

test("a detour goes to a prerequisite and comes back", async ({ page }) => {
  await page.goto("/learn/superposition");
  await page.getByRole("button", { name: "Wait, why?" }).click();
  await page.getByRole("button", { name: /The qubit/ }).click();
  await expect(page.getByText(/Detour: The qubit/)).toBeVisible();
  await playLesson(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Superposition" }),
  ).toBeVisible();
});

test("a circuit puzzle gives feedback and accepts a solution", async ({
  page,
}) => {
  await page.goto("/learn/entanglement");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Puzzle" })).toBeVisible();
  await page.getByRole("button", { name: "Check my circuit" }).click();
  await expect(page.getByText(/Add some gates first/)).toBeVisible();
  // Tap-to-place (the keyboard/touch alternative to drag-and-drop): H on q0, then CNOT from q0.
  await page
    .getByRole("toolbar", { name: "Gates" })
    .getByRole("button", { name: /^H/ })
    .click();
  await page.getByRole("button", { name: "Place H on q0" }).click();
  await page
    .getByRole("toolbar", { name: "Gates" })
    .getByRole("button", { name: /^CNOT/ })
    .click();
  await page.getByRole("button", { name: "Place CNOT on q0" }).click();
  await page.getByRole("button", { name: "Check my circuit" }).click();
  await expect(page.getByText(/Solved!/)).toBeVisible();
});
