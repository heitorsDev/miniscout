import { Router, type RequestHandler } from "express";
import type { TeamsController } from "./team.controller";

export function createTeamsRoutes(
  controller: TeamsController,
  requireMongo: RequestHandler
): Router {
  const router = Router();
  router.get("/admin/competitions/:id/teams", requireMongo, (request, response, next) => {
    void controller.rollupForCompetition(request, response, next);
  });
  return router;
}