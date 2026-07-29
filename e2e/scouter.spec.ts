import { expect, test, type APIRequestContext } from "@playwright/test";
import profile from "./fixtures/profile.json";

const SCOUTER_BASE_URL = process.env.E2E_SCOUTER_URL ?? "http://127.0.0.1:8084";
const ADMIN_BASE_URL = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8083";

async function ensureProfile(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${ADMIN_BASE_URL}/api/admin/profiles`, { data: profile });
  expect([200, 400]).toContain(response.status());
}

async function mintCompetition(
  request: APIRequestContext,
  lanBaseUrl: string,
  name = "Scout E2E"
): Promise<{ id: string; qrToken: string; qrUrl: string }> {
  const response = await request.post(`${ADMIN_BASE_URL}/api/admin/competitions`, {
    data: { name, scoring_profile_name: profile.name, lan_base_url: lanBaseUrl }
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return { id: body.competition._id, qrToken: body.competition.qr_token, qrUrl: body.qr_url };
}

async function fillScouterFields(page: import("@playwright/test").Page, opts: { match: string; team: string; cycles: number }) {
  await page.getByLabel("Match number").fill(opts.match);
  await page.getByLabel("Team number").fill(opts.team);
  for (let i = 0; i < opts.cycles; i += 1) {
    await page.getByRole("button", { name: /Increase Cycles/ }).click();
  }
  await page.getByLabel("Left zone").check();
  await page.getByLabel("Notes").fill("No defense");
}

test.describe("scouter end-to-end flow", () => {
  test.beforeEach(async ({ request }) => {
    await ensureProfile(request);
  });

  test("scouter submits a record and admin sees it", async ({ page, request }) => {
    const minted = await mintCompetition(request, SCOUTER_BASE_URL);

    await page.goto(minted.qrUrl);
    await expect(page.getByRole("heading", { name: /Scout E2E/ })).toBeVisible();

    await page.getByLabel("Display name").fill("Alice");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByTestId("scouter-name")).toHaveText("Alice");
    await fillScouterFields(page, { match: "12", team: "4251", cycles: 3 });
    await page.getByRole("button", { name: "Submit record" }).click();

    await expect(page.getByRole("heading", { name: /Record submitted/ })).toBeVisible();

    const list = await request.get(`${ADMIN_BASE_URL}/api/admin/competitions/${minted.id}/records`);
    expect(list.status()).toBe(200);
    const records = (await list.json()).records;
    expect(records.find((record: { match_number: string; team_number: string }) => record.match_number === "12" && record.team_number === "4251")).toBeTruthy();

    await page.goto(`${ADMIN_BASE_URL}/admin/competitions/${minted.id}`);
    await expect(page.getByTestId("records-table")).toContainText("12");
    await expect(page.getByTestId("records-table")).toContainText("4251");
    await expect(page.getByTestId("records-table")).toContainText("Alice");
  });

  test("reload preserves the scouter name and the unsubmitted draft", async ({ page, request }) => {
    const minted = await mintCompetition(request, SCOUTER_BASE_URL);

    await page.goto(minted.qrUrl);
    await page.getByLabel("Display name").fill("Bob");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("scouter-name")).toHaveText("Bob");

    await fillScouterFields(page, { match: "9", team: "7777", cycles: 4 });

    await page.reload();
    await expect(page.getByTestId("scouter-name")).toHaveText("Bob");
    await expect(page.getByLabel("Match number")).toHaveValue("9");
    await expect(page.getByLabel("Team number")).toHaveValue("7777");
    await expect(page.getByLabel("Left zone")).toBeChecked();
    await expect(page.getByLabel("Notes")).toHaveValue("No defense");
  });
});
