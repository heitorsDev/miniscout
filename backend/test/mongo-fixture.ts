import { MongoMemoryServer } from "mongodb-memory-server";
import { startMongoDatabase, type MongoDatabase } from "../db";

export type MongoFixture = {
  url: string;
  database: MongoDatabase;
  close: () => Promise<void>;
};

export async function startMongoFixture(databaseName?: string): Promise<MongoFixture> {
  const server = await MongoMemoryServer.create();
  const url = server.getUri();
  const database = await startMongoDatabase(url, databaseName);
  return {
    url,
    database,
    close: async () => {
      await database.close();
      await server.stop();
    }
  };
}
