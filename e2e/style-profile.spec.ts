import { expect, test, type APIRequestContext } from "@playwright/test";

const ADMIN_BASE_URL = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8083";

const baselineProfile = {
  name: "Pit-Crew Industrial",
  colors: {
    background: "#14161a",
    surface: "#1c1f26",
    text: "#f5f5f2",
    textMuted: "#9a9fa8",
    accent: "#ff6a00",
    accentContrast: "#14161a",
    border: "#2a2e37",
    danger: "#e5484d",
    success: "#2fae60"
  },
  typography: {
    fontUi: "inter",
    fontMono: "jetbrains-mono"
  },
  logo: {
    dataUri: null,
    teamName: ""
  },
  shape: {
    radius: "sharp",
    density: "compact"
  }
};

async function resetStyleProfile(request: APIRequestContext): Promise<void> {
  const response = await request.put(`${ADMIN_BASE_URL}/api/admin/style-profile`, { data: baselineProfile });
  expect(response.status()).toBe(200);
}

test.describe("admin Settings: StyleProfile live preview + persistence", () => {
  test.beforeEach(async ({ request }) => {
    await resetStyleProfile(request);
  });

  test("changing a color live-previews immediately, then Save persists it across reload", async ({ page }) => {
    await page.goto(`${ADMIN_BASE_URL}/admin/settings`);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const accentInput = page.getByLabel("Accent", { exact: true });
    await expect(accentInput).toHaveValue("#ff6a00");

    // Live preview: changing the picker updates the CSS variable on
    // document.documentElement immediately, with no save/reload.
    await accentInput.evaluate((element: HTMLInputElement) => {
      // React overrides the native value setter to track committed values; setting
      // `.value` directly leaves the tracker in sync, so the synthetic change event
      // never fires. Call the un-patched native setter first to force a mismatch.
      const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      nativeValueSetter.call(element, "#00ff00");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim())
      )
      .toBe("#00ff00");

    const savePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/style-profile") && response.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Save" }).click();
    const saveResponse = await savePromise;
    expect(saveResponse.status()).toBe(200);
    await expect(page.getByRole("status")).toContainText("Style profile saved");

    await page.reload();
    await expect(page.getByLabel("Accent", { exact: true })).toHaveValue("#00ff00");
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim())
      )
      .toBe("#00ff00");
  });

  test("setting a team name persists and renders in the AdminLayout header", async ({ page }) => {
    await page.goto(`${ADMIN_BASE_URL}/admin/settings`);

    const teamNameInput = page.getByLabel("Team name", { exact: true });
    await teamNameInput.fill("Team 254 Panthers");

    const savePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/style-profile") && response.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Save" }).click();
    await savePromise;

    await page.reload();
    await expect(page.getByTestId("admin-brand-logo")).toContainText("Team 254 Panthers");
  });
});
