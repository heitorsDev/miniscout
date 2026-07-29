import { execFileSync } from "node:child_process";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

const adminHealthUrl = process.env.E2E_ADMIN_HEALTH_URL ?? "http://127.0.0.1:8083/api/healthz";
const scouterHealthUrl = process.env.E2E_SCOUTER_HEALTH_URL ?? "http://127.0.0.1:8084/api/healthz";
const readinessTimeoutMs = 90_000;
const pollIntervalMs = 1_000;

async function probe(url: string): Promise<string | null> {
  try {
    const status = execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", url], {
      encoding: "utf8",
      timeout: pollIntervalMs
    });
    return status;
  } catch {
    return null;
  }
}

async function waitForStack(): Promise<void> {
  const deadline = Date.now() + readinessTimeoutMs;

  while (Date.now() < deadline) {
    const [admin, scouter] = await Promise.all([probe(adminHealthUrl), probe(scouterHealthUrl)]);
    if (admin === "200" && scouter === "200") {
      return;
    }

    const delayMs = Math.min(pollIntervalMs, deadline - Date.now());
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Stack did not become ready at admin/scouter within ${Math.round(readinessTimeoutMs / 1000)} seconds`);
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
