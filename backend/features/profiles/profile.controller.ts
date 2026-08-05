import type { Request, Response, NextFunction } from "express";
import { profileNameSchema, validateScoringProfile } from "./profile.schema";
import type { ProfileRepository } from "./profile.repository";
import { ProfileNotFoundError } from "./profile.repository";

export type ProfileController = {
  upload(request: Request, response: Response, next: NextFunction): Promise<void>;
  readByName(request: Request, response: Response, next: NextFunction): Promise<void>;
  list(request: Request, response: Response, next: NextFunction): Promise<void>;
};

function validationResponse(errors: Array<{ path: string; message: string; code: string }>) {
  return {
    error: "Invalid ScoringProfile",
    errors
  };
}

export function createProfileController(repository: ProfileRepository): ProfileController {
  return {
    async upload(request, response, next) {
      const result = validateScoringProfile(request.body);
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
    },
    async readByName(request, response, next) {
      const nameResult = profileNameSchema.safeParse(request.params.name);
      if (!nameResult.success) {
        response.status(400).json(validationResponse(nameResult.error.issues.map((issue) => ({
          path: "name",
          message: issue.message,
          code: issue.code
        }))));
        return;
      }
      try {
        const contents = await repository.loadRaw(nameResult.data);
        response.status(200).type("application/json").send(contents);
      } catch (error) {
        if (error instanceof ProfileNotFoundError) {
          response.status(404).json({ error: "Profile not found" });
          return;
        }
        next(error);
      }
    },
    async list(_request, response, next) {
      try {
        const profiles = await repository.list();
        response.status(200).json({ profiles });
      } catch (error) {
        next(error);
      }
    }
  };
}