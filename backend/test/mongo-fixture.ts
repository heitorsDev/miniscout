import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

export type MongoFixture = {
  url: string;
  client: MongoClient;
  close: () => Promise<void>;
};

export async function startMongoFixture(): Promise<MongoFixture> {
  const server = await MongoMemoryServer.create();
  const url = server.getUri();
  const client = new MongoClient(url);
  await client.connect();
  return {
    url,
    client,
    close: async () => {
      await client.close();
      await server.stop();
    }
  };
}
