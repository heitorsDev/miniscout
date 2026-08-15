import type { Request, Response, NextFunction } from "express";
import { TunnelUrlNotFoundError, type TunnelRepository } from "./tunnel.repository";

export type TunnelController = {
  read(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export function createTunnelController(repository: TunnelRepository): TunnelController {
  return {
    async read(_request, response, next) {
      try {
        const url = await repository.readUrl();
        response.status(200).json({ url });
      } catch (error) {
        if (error instanceof TunnelUrlNotFoundError) {
          response.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    }
  };
}
