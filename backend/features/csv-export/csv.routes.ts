import { Router } from "express";
import type { CsvExportController } from "./csv.controller";

export function createCsvExportRoutes(controller: CsvExportController): Router {
  const router = Router();
  router.post("/admin/export/records.csv", (request, response, next) => {
    void controller.recordsCsv(request, response, next);
  });
  router.get("/admin/export/groups.csv", (request, response, next) => {
    void controller.groupsCsv(request, response, next);
  });
  return router;
}