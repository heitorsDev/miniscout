import { readFile } from "node:fs/promises";

export class TunnelUrlNotFoundError extends Error {
  constructor() {
    super("Tunnel URL not available");
    this.name = "TunnelUrlNotFoundError";
  }
}

export type TunnelRepository = {
  readUrl(): Promise<string>;
};

export function createFileTunnelRepository(filePath: string): TunnelRepository {
  return {
    async readUrl() {
      let contents: string;
      try {
        contents = await readFile(filePath, "utf8");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          throw new TunnelUrlNotFoundError();
        }
        throw error;
      }
      const url = contents.trim();
      if (!url) {
        throw new TunnelUrlNotFoundError();
      }
      return url;
    }
  };
}
