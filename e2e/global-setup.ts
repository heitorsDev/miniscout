import { execFileSync } from "node:child_process";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const cwd = path.resolve(__dirname, "..");
  execFileSync("docker", ["compose", "up", "-d", "--build"], { cwd, stdio: "inherit" });

  return async () => {
    execFileSync("docker", ["compose", "down", "-v"], { cwd, stdio: "inherit" });
  };
}
