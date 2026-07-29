import type { Request, Response, NextFunction } from "express";
import { scouterNameSchema, draftInputSchema } from "./scouter.schema";
import { SCOUTER_COOKIE, SCOUTER_COOKIE_TTL_SECONDS } from "./scouter.types";
import type { ScouterService } from "./scouter.service";
import type { CompetitionService } from "../competitions/competition.service";

export type ScouterController = {
  register(request: Request, response: Response, next: NextFunction): Promise<void>;
  getCookie(request: Request, response: Response, next: NextFunction): Promise<void>;
  upsertDraft(request: Request, response: Response, next: NextFunction): Promise<void>;
  loadDraft(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type ScouterControllerDeps = {
  scouterService: ScouterService;
  competitionService: CompetitionService;
};

function fieldErrors(errors: Array<{ path: string; message: string; code: string }>) {
  return { error: "Invalid request", errors };
}

function errorResponse(message: string) {
  return { error: message };
}

export function createScouterController(deps: ScouterControllerDeps): ScouterController {
  const { scouterService, competitionService } = deps;
  return {
    async register(request, response, next) {
      const qrToken = String(request.params.token);
      try {
        const competition = await competitionService.findByQrToken(qrToken);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const nameResult = scouterNameSchema.safeParse(request.body?.name);
        if (!nameResult.success) {
          response.status(400).json(fieldErrors(nameResult.error.issues.map((issue) => ({
            path: `name.${issue.path.join(".")}`,
            message: issue.message,
            code: issue.code
          }))));
          return;
        }
        const registration = await scouterService.registerScouter(nameResult.data, competition.qr_token);
        response.cookie(SCOUTER_COOKIE, registration.scouter_cookie_id, {
          httpOnly: true,
          sameSite: "lax",
          secure: request.secure,
          maxAge: SCOUTER_COOKIE_TTL_SECONDS * 1000,
          path: "/"
        });
        response.status(200).json({
          scouter_cookie_id: registration.scouter_cookie_id,
          scouter_name: registration.scouter_name
        });
      } catch (error) {
        next(error);
      }
    },
    async getCookie(request, response, next) {
      const cookieId = request.cookies?.[SCOUTER_COOKIE];
      if (!cookieId) {
        response.status(204).end();
        return;
      }
      try {
        const scouter = await scouterService.findScouterByCookie(cookieId);
        if (!scouter) {
          response.status(204).end();
          return;
        }
        response.status(200).json({
          scouter_cookie_id: scouter._id,
          scouter_name: scouter.display_name
        });
      } catch (error) {
        next(error);
      }
    },
    async upsertDraft(request, response, next) {
      const cookieId = request.cookies?.[SCOUTER_COOKIE];
      if (!cookieId) {
        response.status(401).json(errorResponse("Scouter cookie missing"));
        return;
      }
      const qrToken = String(request.params.token);
      const parsed = draftInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        response.status(400).json(fieldErrors(parsed.error.issues.map((issue) => ({
          path: `${issue.path.join(".")}`,
          message: issue.message,
          code: issue.code
        }))));
        return;
      }
      try {
        const competition = await competitionService.findByQrToken(qrToken);
        if (!competition) {
          response.status(404).json(errorResponse("Competition not found"));
          return;
        }
        const draft = await scouterService.upsertDraft(cookieId, competition.qr_token, parsed.data);
        response.status(200).json({
          draft: {
            scouter_name: draft.scouter_name,
            match_number: draft.match_number,
            team_number: draft.team_number,
            values: draft.values,
            updated_at: draft.updated_at.toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    },
    async loadDraft(request, response, next) {
      const cookieId = request.cookies?.[SCOUTER_COOKIE];
      if (!cookieId) {
        response.status(204).end();
        return;
      }
      const qrToken = String(request.params.token);
      try {
        const competition = await competitionService.findByQrToken(qrToken);
        if (!competition) {
          response.status(204).end();
          return;
        }
        const draft = await scouterService.loadDraft(cookieId, competition.qr_token);
        if (!draft) {
          response.status(200).json({ draft: null });
          return;
        }
        response.status(200).json({
          draft: {
            scouter_name: draft.scouter_name,
            match_number: draft.match_number,
            team_number: draft.team_number,
            values: draft.values,
            updated_at: draft.updated_at.toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    }
  };
}