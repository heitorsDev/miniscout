import { Router, type RequestHandler } from "express";
import type { BroadcastController } from "./broadcast.controller";
import type { MatchBroadcaster } from "./broadcaster";
import { openMatchNumberStream } from "./broadcast.stream";

export function createBroadcastRoutes(
  controller: BroadcastController,
  broadcaster: MatchBroadcaster
): Router {
  const router = Router();
  router.get("/scouter/competition/:competitionId", (request, response, next) => {
    void controller.getCurrent(request, response, next);
  });
  router.put("/scouter/competition/:competitionId/match-number", (request, response, next) => {
    void controller.setCurrent(request, response, next);
  });
  router.put("/admin/competition/:competitionId/match-number", (request, response, next) => {
    void controller.setCurrent(request, response, next);
  });
  router.delete("/admin/competition/:competitionId/match-number", (request, response, next) => {
    void controller.clearCurrent(request, response, next);
  });
  router.get("/scouter/competition/:competitionId/stream", (request, response) => {
    openMatchNumberStream(broadcaster, request.params.competitionId, response);
  });
  return router;
}