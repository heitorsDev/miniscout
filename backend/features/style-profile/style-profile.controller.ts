import type { Request, Response, NextFunction } from "express";
import { validateStyleProfile } from "./style-profile.schema";
import type { StyleProfileRepository } from "./style-profile.repository";
import { loadActiveStyleProfile } from "./style-profile.service";

export type StyleProfileController = {
  read(request: Request, response: Response, next: NextFunction): Promise<void>;
  replace(request: Request, response: Response, next: NextFunction): Promise<void>;
};

function validationResponse(errors: Array<{ path: string; message: string; code: string }>) {
  return {
    error: "Invalid StyleProfile",
    errors
  };
}

export function createStyleProfileController(repository: StyleProfileRepository): StyleProfileController {
  return {
    async read(_request, response, next) {
      try {
        const profile = await loadActiveStyleProfile(repository);
        response.status(200).json(profile);
      } catch (error) {
        next(error);
      }
    },
    async replace(request, response, next) {
      const result = validateStyleProfile(request.body);
      if (!result.success) {
        response.status(400).json(validationResponse(result.errors));
        return;
      }
      try {
        await repository.save(result.data);
        response.status(200).json(result.data);
      } catch (error) {
        next(error);
      }
    }
  };
}
