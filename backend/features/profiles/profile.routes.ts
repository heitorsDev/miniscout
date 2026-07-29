import { Router } from "express";
import type { ProfileController } from "./profile.controller";

export function createProfileRoutes(controller: ProfileController): Router {
  const router = Router();
  router.post("/admin/profiles", (request, response, next) => {
    void controller.upload(request, response, next);
  });
  router.get("/admin/profiles/:name", (request, response, next) => {
    void controller.readByName(request, response, next);
  });
  return router;
}