import type { ScouterRepository } from "./scouter.repository";
import { buildDraftDocument, buildScouterDocument } from "./scouter.repository";
import type { DraftDocument, ScouterDocument } from "../../shared/db";
import type { DraftInput, ScouterRegistration } from "./scouter.types";

export type ScouterService = {
  registerScouter(name: string, competitionToken: string): Promise<ScouterRegistration>;
  findScouterByCookie(cookieId: string): Promise<ScouterDocument | null>;
  upsertDraft(cookieId: string, competitionToken: string, draft: DraftInput): Promise<DraftDocument>;
  loadDraft(cookieId: string, competitionToken: string): Promise<DraftDocument | null>;
};

export function createScouterService(repository: ScouterRepository): ScouterService {
  return {
    async registerScouter(name, competitionToken) {
      const doc = buildScouterDocument(name, competitionToken);
      await repository.insertScouter(doc);
      return { scouter_cookie_id: doc._id, scouter_name: name };
    },
    async findScouterByCookie(cookieId) {
      return repository.findScouterByCookie(cookieId);
    },
    async upsertDraft(cookieId, competitionToken, draft) {
      const doc = buildDraftDocument(cookieId, competitionToken, draft);
      await repository.upsertDraft(doc);
      return doc;
    },
    async loadDraft(cookieId, competitionToken) {
      return repository.loadDraft(cookieId, competitionToken);
    }
  };
}