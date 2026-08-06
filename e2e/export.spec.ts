import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import profile from "./fixtures/profile.json";

const repositoryRoot = path.resolve(__dirname, "..");
const composeFiles = ["compose", "-f", "docker-compose.yml", "-f", "e2e/docker-compose.yml"];
const mongoUrl = process.env.E2E_MONGO_URL ?? "mongodb://127.0.0.1:27018/miniscout";

function seedProfileFile(): void {
  const encodedProfile = Buffer.from(JSON.stringify(profile)).toString("base64");
  const script = [
    "const fs=require('node:fs');",
    "fs.mkdirSync('/data/profiles',{recursive:true});",
    "fs.writeFileSync('/data/profiles/e2e-profile.json',Buffer.from(process.env.PROFILE_JSON_BASE64,'base64'));"
  ].join("");
  execFileSync("docker", [
    ...composeFiles,
    "exec",
    "-T",
    "-e",
    `PROFILE_JSON_BASE64=${encodedProfile}`,
    "backend",
    "node",
    "-e",
    script
  ], { cwd: repositoryRoot });
}

test("admin downloads per-record CSV with calculated EstimatedScore", async ({ page }) => {
  seedProfileFile();
  const client = new MongoClient(mongoUrl);
  await client.connect();

  try {
    const database = client.db();
    await Promise.all([
      database.collection("competitions").deleteMany({}),
      database.collection("records").deleteMany({})
    ]);
    const competitionId = new ObjectId();
    await database.collection("competitions").insertOne({
      _id: competitionId,
      name: "Export E2E",
      scoring_profile_path: "/data/profiles/e2e-profile.json",
      created_at: new Date("2026-07-29T10:00:00.000Z")
    });
    await database.collection("records").insertOne({
      competition_id: competitionId,
      match_number: "Q7",
      team_number: "254",
      scouter_name: "Ada",
      scouter_cookie_id: "e2e-cookie",
      values: {
        leave: false,
        cycles: 5,
        notes: "Known counter"
      },
      submitted_at: new Date("2026-07-29T10:05:00.000Z")
    });
  } finally {
    await client.close();
  }

  await page.goto("/admin");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("records.csv");

  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const csv = await readFile(downloadedPath as string, "utf8");
  const [headerLine, recordLine] = csv.trimEnd().split("\r\n");
  const headers = headerLine.split(",");
  const row = recordLine.split(",");

  expect(headers).toEqual([
    "competition_id",
    "match_number",
    "team_number",
    "scouter_name",
    "submitted_at",
    "red_score",
    "blue_score",
    "leave",
    "cycles",
    "notes",
    "estimated_score.total"
  ]);
  expect(row[headers.indexOf("cycles")]).toBe("5");
  expect(row[headers.indexOf("red_score")]).toBe("");
  expect(row[headers.indexOf("blue_score")]).toBe("");
  expect(row[headers.indexOf("estimated_score.total")]).toBe("10");
});
