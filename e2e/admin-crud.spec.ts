import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import profile from "./fixtures/profile.json";

const SCOUTER_BASE_URL = process.env.E2E_SCOUTER_URL ?? "http://127.0.0.1:8084";
const ADMIN_BASE_URL = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8083";
const mongoUrl = process.env.E2E_MONGO_URL ?? "mongodb://127.0.0.1:27018/miniscout";

async function ensureProfile(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${ADMIN_BASE_URL}/api/admin/profiles`, { data: profile });
  expect([200, 400]).toContain(response.status());
}

async function mintCompetition(
  request: APIRequestContext,
  lanBaseUrl: string,
  name = "T06 E2E"
): Promise<{ id: string; qrToken: string }> {
  const response = await request.post(`${ADMIN_BASE_URL}/api/admin/competitions`, {
    data: { name, scoring_profile_name: profile.name, lan_base_url: lanBaseUrl }
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return { id: body.competition._id, qrToken: body.competition.qr_token };
}

async function resetMongo(): Promise<void> {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  try {
    const database = client.db();
    await Promise.all([
      database.collection("competitions").deleteMany({}),
      database.collection("records").deleteMany({}),
      database.collection("scout_records").deleteMany({}),
      database.collection("official_scores").deleteMany({})
    ]);
  } finally {
    await client.close();
  }
}

async function submitRecord(
  request: APIRequestContext,
  qrToken: string,
  scouterName: string,
  body: { match_number: string; team_number: string; values: Record<string, unknown> }
): Promise<{ record_id: string }> {
  const register = await request.post(`${SCOUTER_BASE_URL}/api/competitions/${qrToken}/scouter`, {
    data: { name: scouterName }
  });
  expect(register.status()).toBe(200);
  const cookie = register.headersArray().find((header) => header.name.toLowerCase() === "set-cookie");
  expect(cookie).toBeDefined();
  const cookieValue = cookie?.value?.split(";")[0] ?? "";

  const submit = await request.post(`${SCOUTER_BASE_URL}/api/competitions/${qrToken}/records`, {
    headers: { Cookie: cookieValue },
    data: { scouter_name: scouterName, ...body }
  });
  expect(submit.status()).toBe(201);
  return submit.json();
}

async function upsertOfficialScore(
  request: APIRequestContext,
  competitionId: string,
  matchNumber: string,
  redScore: number,
  blueScore: number
): Promise<void> {
  const response = await request.put(
    `${ADMIN_BASE_URL}/api/admin/competitions/${competitionId}/official-scores`,
    { data: { match_number: matchNumber, red_score: redScore, blue_score: blueScore } }
  );
  expect(response.status()).toBe(200);
}

async function deleteRecordViaUi(page: Page, recordId: string): Promise<void> {
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`delete-record-${recordId}`).click();
  await expect(page.getByTestId(`delete-record-${recordId}`)).toHaveCount(0);
}

test.describe("admin T06 CRUD + official scores + CSV exports", () => {
  test.beforeEach(async ({ request }) => {
    await resetMongo();
    await ensureProfile(request);
  });

  test("admin enters OfficialScores, deletes a typo record, exports CSVs with red/blue score columns", async ({ page, request }) => {
    const minted = await mintCompetition(request, SCOUTER_BASE_URL);
    const competitionId = minted.id;

    const typo = await submitRecord(request, minted.qrToken, "Eve", {
      match_number: "Q1",
      team_number: "9999",
      values: { leave: false, cycles: 1, notes: "typo team" }
    });
    const real1 = await submitRecord(request, minted.qrToken, "Alice", {
      match_number: "Q1",
      team_number: "12",
      values: { leave: true, cycles: 5, notes: "fast" }
    });
    await submitRecord(request, minted.qrToken, "Bob", {
      match_number: "Q2",
      team_number: "12",
      values: { leave: false, cycles: 3, notes: "steady" }
    });

    await upsertOfficialScore(request, competitionId, "Q1", 110, 95);
    await upsertOfficialScore(request, competitionId, "Q2", 80, 100);

    await page.goto(`${ADMIN_BASE_URL}/admin/competitions/${competitionId}`);
    await expect(page.getByTestId("official-score-row")).toHaveCount(2);
    await deleteRecordViaUi(page, typo.record_id);

    const recordsDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const recordsDownloadFile = await recordsDownload;
    expect(recordsDownloadFile.suggestedFilename()).toBe("records.csv");
    const recordsPath = await recordsDownloadFile.path();
    expect(recordsPath).not.toBeNull();
    const recordsCsv = await readFile(recordsPath as string, "utf8");
    const recordsLines = recordsCsv.trimEnd().split("\r\n");
    expect(recordsLines[0]).toBe(
      "competition_id,match_number,team_number,scouter_name,submitted_at,red_score,blue_score,leave,cycles,notes,estimated_score.total"
    );
    const headerToIndex = (header: string) => recordsLines[0].split(",").indexOf(header);

    const realRow = recordsLines.find((line) => line.startsWith(`${competitionId},Q1,12,Alice`));
    expect(realRow).toBeDefined();
    const cells = realRow!.split(",");
    expect(cells[headerToIndex("red_score")]).toBe("110");
    expect(cells[headerToIndex("blue_score")]).toBe("95");

    const q2Row = recordsLines.find((line) => line.startsWith(`${competitionId},Q2,12,Bob`));
    expect(q2Row).toBeDefined();
    const q2Cells = q2Row!.split(",");
    expect(q2Cells[headerToIndex("red_score")]).toBe("80");
    expect(q2Cells[headerToIndex("blue_score")]).toBe("100");

    const typoRows = recordsLines.filter((line) => line.includes("9999"));
    expect(typoRows).toHaveLength(0);

    expect(recordsLines.find((line) => line.includes(real1.record_id))).toBeUndefined();

    const groupsResponse = await request.get(`${ADMIN_BASE_URL}/api/admin/export/groups.csv`);
    expect(groupsResponse.status()).toBe(200);
    const groupsCsv = await groupsResponse.text();
    const groupsLines = groupsCsv.trimEnd().split("\r\n");
    const groupsHeader = groupsLines[0].split(",");
    expect(groupsHeader).toContain("red_score");
    expect(groupsHeader).toContain("blue_score");

    const groupsRowFor = (match: string, team: string) =>
      groupsLines.find((line) => line.split(",").includes(match) && line.split(",").includes(team));
    const q1GroupRow = groupsRowFor("Q1", "12");
    expect(q1GroupRow).toBeDefined();
    const q1Cells = q1GroupRow!.split(",");
    expect(q1Cells[groupsHeader.indexOf("red_score")]).toBe("110");
    expect(q1Cells[groupsHeader.indexOf("blue_score")]).toBe("95");

    const q2GroupRow = groupsRowFor("Q2", "12");
    expect(q2GroupRow).toBeDefined();
    const q2GroupCells = q2GroupRow!.split(",");
    expect(q2GroupCells[groupsHeader.indexOf("red_score")]).toBe("80");
    expect(q2GroupCells[groupsHeader.indexOf("blue_score")]).toBe("100");

    expect(groupsLines.filter((line) => line.includes("9999"))).toHaveLength(0);

    const teamsResponse = await request.get(`${ADMIN_BASE_URL}/api/admin/competitions/${competitionId}/teams`);
    expect(teamsResponse.status()).toBe(200);
    const teams = (await teamsResponse.json()).teams;
    const team12 = teams.find((row: { team_number: string }) => row.team_number === "12");
    expect(team12).toMatchObject({
      team_number: "12",
      record_count: 2,
      matches_scouted: ["Q1", "Q2"]
    });
    const team9999 = teams.find((row: { team_number: string }) => row.team_number === "9999");
    expect(team9999).toBeUndefined();
  });
});