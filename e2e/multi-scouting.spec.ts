import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import profile from "./fixtures/profile.json";

const ADMIN = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8083";
const SCOUTER = process.env.E2E_SCOUTER_URL ?? "http://127.0.0.1:8084";

async function submit(context: BrowserContext, url: string, name: string, cycles: number): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Match number").fill("41");
  await page.getByLabel("Team number").fill("4251");
  for (let i = 0; i < cycles; i += 1) await page.getByRole("button", { name: /Increase Cycles/ }).click();
  await page.getByLabel("Left starting area").check();
  await page.getByRole("button", { name: "Submit record" }).click();
  await expect(page.getByRole("heading", { name: "Record submitted" })).toBeVisible();
  return page;
}

test("multi-scouting aggregates odd/even groups and exports group CSV", async ({ browser, request }) => {
  await request.post(`${ADMIN}/api/admin/profiles`, { data: profile });
  const mint = await request.post(`${ADMIN}/api/admin/competitions`, { data: { name: "Multi", scoring_profile_name: profile.name, lan_base_url: SCOUTER } });
  const competition = (await mint.json()).competition;
  const url = `${SCOUTER}/scout?c=${competition.qr_token}`;
  const alice = await browser.newContext();
  const bob = await browser.newContext();
  const cara = await browser.newContext();
  await submit(alice, url, "Alice", 1);
  const bobPage = await submit(bob, url, "Bob", 3);
  await bobPage.goto(`${ADMIN}/admin/competitions/${competition._id}`);
  await expect(bobPage.getByTestId("groups-table")).toContainText("Yes");
  await expect(bobPage.getByTestId("groups-table")).toContainText("7");
  await submit(cara, url, "Cara", 5);
  await bobPage.reload();
  await expect(bobPage.getByTestId("groups-table")).toContainText("9");
  await bobPage.getByRole("button", { name: "41" }).click();
  await expect(bobPage.getByTestId("group-detail")).toContainText("Alice");
  await expect(bobPage.getByTestId("group-detail")).toContainText("Bob");
  await expect(bobPage.getByTestId("group-detail")).toContainText("Cara");
  const csv = await request.get(`${ADMIN}/api/admin/export/groups.csv`);
  expect(await csv.text()).toContain("41,4251,3,9,true");
  await Promise.all([alice.close(), bob.close(), cara.close()]);
});
