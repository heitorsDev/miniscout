import { Router } from "express";
import type { TunnelController } from "./tunnel.controller";

export function createTunnelRoutes(controller: TunnelController): Router {
  const router = Router();
  router.get("/admin/tunnel-url", (request, response, next) => {
    void controller.read(request, response, next);
  });
  return router;
}
