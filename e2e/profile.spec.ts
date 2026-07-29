import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import profile from "./fixtures/profile.json";

test("admin uploads Profile JSON and reads it back", async ({ page, request }) => {
  const fixturePath = path.join(__dirname, "fixtures/profile.json");
  const fixtureBytes = fs.readFileSync(fixturePath);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  await page.getByLabel("Profile JSON file").setInputFiles(fixturePath);
  await expect(page.getByTestId("diff-preview")).toContainText("e2e-profile");
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/profiles") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Upload profile" }).click();
  const uploadResponse = await uploadResponsePromise;
  await expect(page.getByRole("status")).toContainText("Profile saved");
  expect(uploadResponse.status()).toBe(200);
  expect(await uploadResponse.json()).toEqual(profile);

  await page.getByLabel("Profile name").fill("e2e-profile");
  await page.getByRole("button", { name: "Fetch profile" }).click();
  await expect(page.getByTestId("fetched-profile")).toContainText("e2e-profile");

  const response = await request.get("/api/admin/profiles/e2e-profile");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual(profile);
  expect(await response.body()).toEqual(fixtureBytes);
});
