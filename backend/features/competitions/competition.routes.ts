import { Router, type RequestHandler } from "express";
import type { CompetitionController } from "./competition.controller";

export function createCompetitionRoutes(
  controller: CompetitionController,
  requireMongo: RequestHandler
): Router {
  const router = Router();
  router.post("/admin/competitions", requireMongo, (request, response, next) => {
    void controller.mint(request, response, next);
  });
  router.get("/admin/competitions", requireMongo, (request, response, next) => {
    void controller.list(request, response, next);
  });
  return router;
}