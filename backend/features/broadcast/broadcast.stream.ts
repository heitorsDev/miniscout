import type { Response } from "express";
import type { CompetitionId, MatchBroadcaster, MatchEvent } from "./broadcaster";

const HEARTBEAT_INTERVAL_MS = 15_000;

export type StreamHandle = {
  close: () => void;
};

function writeMatchNumberEvent(
  response: Response,
  competitionId: CompetitionId,
  value: number | null,
  updatedAt: string
): void {
  response.write(`event: match-number\ndata: ${JSON.stringify({
    competition_id: competitionId,
    current_match_number: value,
    updated_at: updatedAt
  })}\n\n`);
}

export function openMatchNumberStream(
  broadcaster: MatchBroadcaster,
  competitionId: CompetitionId,
  response: Response
): StreamHandle {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();

  let closed = false;

  const write = (chunk: string): void => {
    if (closed) {
      return;
    }
    try {
      response.write(chunk);
    } catch {
      close();
    }
  };

  const writeEvent = (event: MatchEvent): void => {
    const value = event.type === "updated" ? event.value : null;
    writeMatchNumberEvent(response, competitionId, value, event.updatedAt);
  };

  broadcaster.getCurrent(competitionId)
    .then((value) => writeMatchNumberEvent(response, competitionId, value, new Date().toISOString()))
    .catch(() => { close(); });

  const unsubscribe = broadcaster.subscribe(competitionId, writeEvent);

  const heartbeat = setInterval(() => {
    write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_INTERVAL_MS);

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    response.end();
  };

  response.on("close", close);

  return { close };
}