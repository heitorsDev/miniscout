import { Router, type RequestHandler } from "express";
import type { CompetitionController } from "./competition.controller";
import type { CompetitionLookupController } from "./competition.lookup.controller";

export type CompetitionRoutesDeps = {
  controller: CompetitionController;
  lookupController: CompetitionLookupController;
};

export function createCompetitionRoutes(
  deps: CompetitionRoutesDeps,
  requireMongo: RequestHandler
): Router {
  const { controller, lookupController } = deps;
  const router = Router();
  router.post("/admin/competitions", requireMongo, (request, response, next) => {
    void controller.mint(request, response, next);
  });
  router.get("/admin/competitions", requireMongo, (request, response, next) => {
    void controller.list(request, response, next);
  });
  router.get("/competitions/:token", requireMongo, (request, response, next) => {
    void lookupController.resolveByQrToken(request, response, next);
  });
  return router;
}