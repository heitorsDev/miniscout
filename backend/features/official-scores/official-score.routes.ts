import { Router, type RequestHandler } from "express";
import type { OfficialScoreController } from "./official-score.controller";

export function createOfficialScoreRoutes(
  controller: OfficialScoreController,
  requireMongo: RequestHandler
): Router {
  const router = Router();
  router.put("/admin/competitions/:id/official-scores", requireMongo, (request, response, next) => {
    void controller.upsert(request, response, next);
  });
  router.get("/admin/competitions/:id/official-scores", requireMongo, (request, response, next) => {
    void controller.list(request, response, next);
  });
  return router;
}