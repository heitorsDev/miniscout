import { execFileSync } from "node:child_process";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

const healthUrl = "http://127.0.0.1:8081/api/healthz";
const readinessTimeoutMs = 60_000;
const pollIntervalMs = 1_000;

async function waitForStack(): Promise<void> {
  const deadline = Date.now() + readinessTimeoutMs;

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();

    try {
      const status = execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", healthUrl], {
        encoding: "utf8",
        timeout: Math.min(pollIntervalMs, remainingMs)
      });
      if (status === "200") {
        return;
      }
    } catch {
    }

    const delayMs = Math.min(pollIntervalMs, deadline - Date.now());
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Stack did not become ready at ${healthUrl} within 60 seconds`);
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const cwd = path.resolve(__dirname, "..");
  execFileSync("docker", ["compose", "up", "-d", "--build"], { cwd, stdio: "inherit" });

  try {
    await waitForStack();
  } catch (error) {
    try {
      execFileSync("docker", ["compose", "down", "-v"], { cwd, stdio: "inherit" });
    } catch {
    }
    throw error;
  }

  return async () => {
    execFileSync("docker", ["compose", "down", "-v"], { cwd, stdio: "inherit" });
  };
}
