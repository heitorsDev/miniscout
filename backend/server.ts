import { startMongoDatabase } from "./db";
import { createApp } from "./app";
import { MongoMatchBroadcaster } from "./match-broadcaster";

const mongoUrl = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017/miniscout";
const port = Number(process.env.PORT ?? 3000);

async function buildBroadcaster(database: Awaited<ReturnType<typeof startMongoDatabase>>): Promise<MongoMatchBroadcaster> {
  const collection = database.db.collection<{
    _id: string;
    current_match_number: number | null;
    updated_at: string;
  }>("competitions");
  return await MongoMatchBroadcaster.load(collection);
}

async function main(): Promise<void> {
  const database = await startMongoDatabase(mongoUrl);
  const matchBroadcaster = await buildBroadcaster(database);
  const app = createApp({
    mongoDatabase: database,
    matchBroadcaster
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