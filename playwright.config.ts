import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8081",
    trace: "retain-on-failure"
  },
  reporter: process.env.CI ? "line" : "list"
});
