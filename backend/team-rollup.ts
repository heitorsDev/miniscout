import {
  calculateEstimatedScore,
  type RecordValues,
  type ScoringProfileInput
} from "./scoring";

export type ScoutRecordForRollup = {
  _id: string;
  match_number: string;
  team_number: string;
  values: RecordValues;
};

export type TeamMatchRollup = {
  match_number: string;
  record_count: number;
  median_estimated_score: number;
};

export type TeamRollup = {
  team_number: string;
  record_count: number;
  matches_scouted: string[];
  matches: TeamMatchRollup[];
};

export function median(values: readonly number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return 0;
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function naturalCompare(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function buildTeamRollups(
  records: readonly ScoutRecordForRollup[],
  profile: ScoringProfileInput | null
): TeamRollup[] {
  const groupedByTeam = new Map<string, ScoutRecordForRollup[]>();
  for (const record of records) {
    const bucket = groupedByTeam.get(record.team_number) ?? [];
    bucket.push(record);
    groupedByTeam.set(record.team_number, bucket);
  }

  const teamNumbers = Array.from(groupedByTeam.keys()).sort(naturalCompare);

  return teamNumbers.map((teamNumber) => {
    const teamRecords = groupedByTeam.get(teamNumber) ?? [];

    const groupedByMatch = new Map<string, ScoutRecordForRollup[]>();
    for (const record of teamRecords) {
      const bucket = groupedByMatch.get(record.match_number) ?? [];
      bucket.push(record);
      groupedByMatch.set(record.match_number, bucket);
    }

    const matchNumbers = Array.from(groupedByMatch.keys()).sort(naturalCompare);

    const matches: TeamMatchRollup[] = matchNumbers.map((matchNumber) => {
      const matchRecords = groupedByMatch.get(matchNumber) ?? [];
      const totals = matchRecords.map((record) => {
        if (profile === null) {
          return 0;
        }
        return calculateEstimatedScore(record.values, profile).total;
      });
      return {
        match_number: matchNumber,
        record_count: matchRecords.length,
        median_estimated_score: median(totals)
      };
    });

    return {
      team_number: teamNumber,
      record_count: teamRecords.length,
      matches_scouted: matchNumbers,
      matches
    };
  });
}