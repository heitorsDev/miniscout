import { Router, type RequestHandler } from "express";
import type { ScouterController } from "./scouter.controller";

export function createScouterRoutes(
  controller: ScouterController,
  requireMongo: RequestHandler
): Router {
  const router = Router();
  router.post("/competitions/:token/scouter", requireMongo, (request, response, next) => {
    void controller.register(request, response, next);
  });
  router.get("/competitions/:token/scouter", requireMongo, (request, response, next) => {
    void controller.getCookie(request, response, next);
  });
  router.put("/competitions/:token/draft", requireMongo, (request, response, next) => {
    void controller.upsertDraft(request, response, next);
  });
  router.get("/competitions/:token/draft", requireMongo, (request, response, next) => {
    void controller.loadDraft(request, response, next);
  });
  return router;
}