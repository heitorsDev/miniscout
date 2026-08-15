import { startMongoDatabase } from "./shared/db";
import { createApp } from "./app";
import { loadMongoBroadcaster } from "./features/broadcast/broadcast.repository";
import type { MatchBroadcaster } from "./features/broadcast/broadcaster";
import { createFileProfileRepository } from "./features/profiles/profile.repository";
import { seedDefaultProfileIfEmpty } from "./features/profiles/profile.service";

const mongoUrl = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017/miniscout";
const port = Number(process.env.PORT ?? 3000);
const profileStoragePath = process.env.PROFILE_STORAGE_PATH ?? "/data/profiles";

async function buildBroadcaster(database: Awaited<ReturnType<typeof startMongoDatabase>>): Promise<MatchBroadcaster> {
  const collection = database.db.collection<{
    _id: string;
    current_match_number: number | null;
    updated_at: string;
  }>("match_broadcast_state");
  return await loadMongoBroadcaster(collection);
}

async function main(): Promise<void> {
  const database = await startMongoDatabase(mongoUrl);
  const matchBroadcaster = await buildBroadcaster(database);
  await seedDefaultProfileIfEmpty(createFileProfileRepository(profileStoragePath));
  const app = createApp({
    mongoDatabase: database,
    matchBroadcaster,
    profileStoragePath
  });
  const server = app.listen(port, "0.0.0.0", () => {
    process.stdout.write(`backend listening on ${port}\n`);
  });

  const shutdown = async () => {
    server.close();
    await database.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  process.stderr.write(`backend failed to start: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});