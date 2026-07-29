import http, { type IncomingMessage } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { InMemoryMatchBroadcaster, type MatchBroadcaster } from "./match-broadcaster";

type ReceivedEvent = {
  event: string;
  data: string;
};

async function withSseServer(
  broadcaster: MatchBroadcaster,
  callback: (baseUrl: string, cleanup: () => Promise<void>) => Promise<void>
): Promise<void> {
  const app = createApp({ matchBroadcaster: broadcaster });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cleanup = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  try {
    await callback(baseUrl, cleanup);
  } finally {
    await cleanup();
  }
}

async function collectEvents(
  url: string,
  minCount: number,
  timeoutMs: number
): Promise<ReceivedEvent[]> {
  return await new Promise<ReceivedEvent[]>((resolve, reject) => {
    const collected: ReceivedEvent[] = [];
    let resolved = false;
    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      requestOptions.destroy();
      resolve(collected);
    };

    const requestOptions = http.request(url, {
      method: "GET",
      headers: { Accept: "text/event-stream" }
    });
    requestOptions.on("error", reject);
    requestOptions.on("response", (incoming: IncomingMessage) => {
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk: string) => {
        for (const block of chunk.split("\n\n")) {
          if (!block.trim()) {
            continue;
          }
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }
          collected.push({ event: eventName, data: dataLines.join("\n") });
          if (collected.length >= minCount) {
            finish();
            return;
          }
        }
      });
      incoming.on("end", finish);
      incoming.on("error", reject);
    });
    requestOptions.end();
    setTimeout(finish, timeoutMs);
  });
}

describe("scouter match broadcast SSE stream", () => {
  let broadcaster: MatchBroadcaster;

  beforeEach(() => {
    broadcaster = new InMemoryMatchBroadcaster();
  });

  afterEach(async () => {
    await broadcaster.clearCurrent("default");
  });

  it("emits the current match number on connect", async () => {
    await broadcaster.setCurrent("default", 7);

    const events: ReceivedEvent[] = [];
    await withSseServer(broadcaster, async (baseUrl) => {
      const url = `${baseUrl}/api/scouter/competition/default/stream`;
      events.push(...(await collectEvents(url, 1, 2000)));
    });

    expect(events.length).toBe(1);
    expect(events[0].event).toBe("match-number");
    expect(JSON.parse(events[0].data)).toEqual({
      competition_id: "default",
      current_match_number: 7,
      updated_at: expect.any(String)
    });
  });

  it("emits current_match_number: null on connect when no value has been broadcast", async () => {
    const events: ReceivedEvent[] = [];
    await withSseServer(broadcaster, async (baseUrl) => {
      const url = `${baseUrl}/api/scouter/competition/default/stream`;
      events.push(...(await collectEvents(url, 1, 2000)));
    });

    expect(events.length).toBe(1);
    expect(JSON.parse(events[0].data).current_match_number).toBeNull();
  });

  it("delivers an update event after a scouter PUT via the same broadcaster", async () => {
    const events: ReceivedEvent[] = [];
    await withSseServer(broadcaster, async (baseUrl) => {
      const url = `${baseUrl}/api/scouter/competition/default/stream`;
      const collectionPromise = collectEvents(url, 3, 5000);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await broadcaster.setCurrent("default", 7);
      await broadcaster.setCurrent("default", 8);
      events.push(...(await collectionPromise));
    });

    const payloads = events
      .filter((event) => event.event === "match-number")
      .map((event) => JSON.parse(event.data));
    expect(payloads.length).toBeGreaterThanOrEqual(3);
    expect(payloads[0]).toMatchObject({ current_match_number: null });
    expect(payloads[1]).toMatchObject({ current_match_number: 7 });
    expect(payloads[2]).toMatchObject({ current_match_number: 8 });
  });

  it("delivers an admin clear event as current_match_number: null", async () => {
    await broadcaster.setCurrent("default", 7);

    const events: ReceivedEvent[] = [];
    await withSseServer(broadcaster, async (baseUrl) => {
      const url = `${baseUrl}/api/scouter/competition/default/stream`;
      const collectionPromise = collectEvents(url, 2, 5000);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await broadcaster.clearCurrent("default");
      events.push(...(await collectionPromise));
    });

    const payloads = events
      .filter((event) => event.event === "match-number")
      .map((event) => JSON.parse(event.data));
    expect(payloads.length).toBeGreaterThanOrEqual(2);
    expect(payloads[0]).toMatchObject({ current_match_number: 7 });
    expect(payloads[1]).toMatchObject({ current_match_number: null });
  });
});
