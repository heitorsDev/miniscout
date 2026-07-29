import { expect, test } from "@playwright/test";

const SCOUTER_URL = "/scout";
const ADMIN_URL = "/admin";
const COMPETITION_ID = "default";

async function readCurrentMatch(page: import("@playwright/test").Page): Promise<string> {
  await expect(page.getByTestId("sse-state")).toHaveText("live", { timeout: 10_000 });
  return (await page.getByTestId("current-match-number").textContent())?.trim() ?? "";
}

async function adminCurrentMatch(page: import("@playwright/test").Page): Promise<string> {
  await expect(page.getByTestId("admin-current-match")).toBeVisible();
  return ((await page.getByTestId("admin-current-match").textContent()) ?? "").trim();
}

test.describe("current match broadcast across scouters", () => {
  test.beforeEach(async ({ request }) => {
    await request.delete(`/api/admin/competition/${COMPETITION_ID}/match-number`);
  });

  test("scouter broadcasts match 7 and a second scouter observes it within 2 seconds", async ({ browser }) => {
    const scouterA = await browser.newContext();
    const scouterB = await browser.newContext();
    const pageA = await scouterA.newPage();
    const pageB = await scouterB.newPage();

    try {
      await pageA.goto(SCOUTER_URL);
      await pageB.goto(SCOUTER_URL);

      await expect.poll(async () => readCurrentMatch(pageA), { timeout: 5_000 }).toBe("—");
      await expect.poll(async () => readCurrentMatch(pageB), { timeout: 5_000 }).toBe("—");

      await pageA.getByTestId("match-input").fill("7");
      const start = Date.now();
      const responsePromise = pageA.waitForResponse((response) =>
        response.url().endsWith(`/api/scouter/competition/${COMPETITION_ID}/match-number`)
        && response.request().method() === "PUT"
      );
      await pageA.getByTestId("broadcast-button").click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);

      await expect(pageA.getByTestId("current-match-number")).toHaveText("7", { timeout: 2_000 });
      await expect(pageB.getByTestId("current-match-number")).toHaveText("7", { timeout: 2_000 });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2_000);
    } finally {
      await scouterA.close();
      await scouterB.close();
    }
  });

  test("admin override updates every connected scouter within 2 seconds", async ({ browser, page }) => {
    const scouterA = await browser.newContext();
    const scouterB = await browser.newContext();
    const pageA = await scouterA.newPage();
    const pageB = await scouterB.newPage();

    try {
      await pageA.goto(SCOUTER_URL);
      await pageB.goto(SCOUTER_URL);

      await page.goto(ADMIN_URL);

      await page.getByTestId("admin-match-input").fill("8");
      const start = Date.now();
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/competition/${COMPETITION_ID}/match-number`)
        && response.request().method() === "PUT"
      );
      await page.getByTestId("admin-set-match").click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);

      await expect(pageA.getByTestId("current-match-number")).toHaveText("8", { timeout: 2_000 });
      await expect(pageB.getByTestId("current-match-number")).toHaveText("8", { timeout: 2_000 });

      expect(await adminCurrentMatch(page)).toBe("8");
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2_000);
    } finally {
      await scouterA.close();
      await scouterB.close();
    }
  });
});
