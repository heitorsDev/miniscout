import type { TeamRepository } from "./team.repository";
import type { CompetitionService } from "../competitions/competition.service";
import { loadValidatedProfile } from "../profiles/profile.service";
import {
  buildTeamRollups,
  type ScoutRecordForRollup,
  type TeamRollup
} from "./team-rollup";
import type { ScoringProfileInput } from "../scoring/scoring";
import type { ScoutRecordDocument } from "../../shared/db";

export type TeamService = {
  getRollupsForCompetition(competitionId: string): Promise<TeamRollup[] | null>;
  computeRollups(records: readonly ScoutRecordDocument[], profile: ScoringProfileInput): TeamRollup[];
};

export type TeamServiceDeps = {
  competitionService: CompetitionService;
  teamRepository: TeamRepository;
  profileStoragePath: string;
};

export function createTeamService(deps: TeamServiceDeps): TeamService {
  const { competitionService, teamRepository, profileStoragePath } = deps;
  const service: TeamService = {
    async getRollupsForCompetition(competitionId) {
      const competition = await competitionService.findById(competitionId);
      if (!competition) return null;
      const profile = await loadValidatedProfile(
        profileStoragePath,
        competition.scoring_profile_name
      );
      const records = await teamRepository.listByCompetition(competitionId);
      return service.computeRollups(records, profile);
    },
    computeRollups(records, profile) {
      return buildTeamRollups(
        records.map((doc): ScoutRecordForRollup => ({
          _id: doc._id,
          match_number: doc.match_number,
          team_number: doc.team_number,
          values: doc.values
        })),
        profile
      );
    }
  };
  return service;
}
