import type { Request, Response, NextFunction } from "express";
import type { RecordExportDataLoader } from "./csv.types";
import { createGroupsCsv } from "./group-export";
import { createRecordsCsv, loadScoringProfile } from "./record-export";

export type CsvExportController = {
  recordsCsv(request: Request, response: Response, next: NextFunction): Promise<void>;
  groupsCsv(request: Request, response: Response, next: NextFunction): Promise<void>;
};

export type CsvExportControllerDeps = {
  loadRecordExportData: RecordExportDataLoader;
  profileStoragePath: string;
};

export function createCsvExportController(deps: CsvExportControllerDeps): CsvExportController {
  const { loadRecordExportData, profileStoragePath } = deps;
  return {
    async recordsCsv(_request, response, next) {
      try {
        const exportData = await loadRecordExportData();
        if (!exportData) {
          response.status(404).json({ error: "Competition not found" });
          return;
        }
        const profile = await loadScoringProfile(profileStoragePath, exportData.scoringProfilePath);
        const csv = createRecordsCsv(exportData.records, profile, exportData.officialScoresByMatch);
        response
          .status(200)
          .set("Content-Disposition", "attachment; filename=\"records.csv\"")
          .type("text/csv")
          .send(csv);
      } catch (error) {
        next(error);
      }
    },
    async groupsCsv(_request, response, next) {
      try {
        const exportData = await loadRecordExportData();
        if (!exportData) return void response.status(404).json({ error: "Competition not found" });
        const profile = await loadScoringProfile(profileStoragePath, exportData.scoringProfilePath);
        response.status(200).set("Content-Disposition", "attachment; filename=\"groups.csv\"").type("text/csv").send(createGroupsCsv(exportData.records, profile, exportData.officialScoresByMatch));
      } catch (error) {
        next(error);
      }
    }
  };
}