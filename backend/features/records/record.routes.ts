import { Router, type RequestHandler } from "express";
import type { RecordController } from "./record.controller";

export function createRecordRoutes(
  controller: RecordController,
  requireMongo: RequestHandler
): Router {
  const router = Router();
  router.post("/competitions/:token/records", requireMongo, (request, response, next) => {
    void controller.submit(request, response, next);
  });
  router.delete("/admin/records/:id", requireMongo, (request, response, next) => {
    void controller.delete(request, response, next);
  });
  router.get("/admin/competitions/:id/records", requireMongo, (request, response, next) => {
    void controller.listGroups(request, response, next);
  });
  router.get("/admin/competitions/:id/groups/:match/:team", requireMongo, (request, response, next) => {
    void controller.getGroup(request, response, next);
  });
  router.get("/competitions/:token/existing-scouts", requireMongo, (request, response, next) => {
    void controller.existingScouts(request, response, next);
  });
  return router;
}