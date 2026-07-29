import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["frontend/**", "jsdom"]],
    include: ["backend/**/*.test.ts", "frontend/**/*.test.{ts,tsx}"],
    testTimeout: 120_000,
    hookTimeout: 120_000
  }
});
