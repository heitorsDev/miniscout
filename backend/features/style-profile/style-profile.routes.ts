import { Router } from "express";
import type { StyleProfileController } from "./style-profile.controller";

/**
 * GET /style-profile is unauthenticated: the public scouter page needs to
 * read the active visual identity without an admin session or a database.
 * PUT /admin/style-profile follows the same /admin prefix convention as the
 * rest of the admin API (see profile.routes.ts).
 */
export function createStyleProfileRoutes(controller: StyleProfileController): Router {
  const router = Router();
  router.get("/style-profile", (request, response, next) => {
    void controller.read(request, response, next);
  });
  router.put("/admin/style-profile", (request, response, next) => {
    void controller.replace(request, response, next);
  });
  return router;
}
