import type { CompetitionRepository } from "./competition.repository";
import { mintCompetitionFromInput, viewCompetition } from "./competition.repository";
import type { CompetitionDocument } from "../../shared/db";
import { ProfileNotFoundError } from "../profiles/profile.repository";
import type { ProfileRepository } from "../profiles/profile.repository";
import type { CompetitionView, MintCompetitionInput, MintCompetitionResult } from "./competition.types";

export class CompetitionProfileMissingError extends Error {
  constructor(public readonly profileName: string) {
    super(`ScoringProfile "${profileName}" not found`);
    this.name = "CompetitionProfileMissingError";
  }
}

export class CompetitionProfileDiskMissingError extends Error {
  constructor(public readonly profileName: string) {
    super(`ScoringProfile "${profileName}" not found on disk`);
    this.name = "CompetitionProfileDiskMissingError";
  }
}

export type CompetitionLookupResult = {
  competition: CompetitionDocument;
  profile: unknown;
};

export type CompetitionService = {
  mintCompetition(input: MintCompetitionInput): Promise<MintCompetitionResult>;
  findByQrToken(qrToken: string): Promise<CompetitionDocument | null>;
  findById(id: string): Promise<CompetitionDocument | null>;
  list(): Promise<CompetitionView[]>;
  lookupByQrToken(qrToken: string): Promise<CompetitionLookupResult | null>;
};

export function createCompetitionService(
  repository: CompetitionRepository,
  profileRepository: ProfileRepository
): CompetitionService {
  return {
    async mintCompetition(input) {
      const exists = await profileRepository.exists(input.scoring_profile_name);
      if (!exists) {
        throw new CompetitionProfileMissingError(input.scoring_profile_name);
      }
      const { document, qr_url } = mintCompetitionFromInput(input);
      await repository.insert(document);
      return { competition: viewCompetition(document), qr_url };
    },
    async findByQrToken(qrToken) {
      return repository.findByQrToken(qrToken);
    },
    async findById(id) {
      return repository.findById(id);
    },
    async list() {
      return repository.list();
    },
    async lookupByQrToken(qrToken) {
      const competition = await repository.findByQrToken(qrToken);
      if (!competition) return null;
      try {
        const profile = await profileRepository.load(competition.scoring_profile_name);
        return { competition, profile };
      } catch (error) {
        if (error instanceof ProfileNotFoundError) {
          throw new CompetitionProfileDiskMissingError(competition.scoring_profile_name);
        }
        throw error;
      }
    }
  };
}
