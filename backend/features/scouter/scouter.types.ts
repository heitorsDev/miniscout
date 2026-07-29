import type { z } from "zod";
import type { draftInputSchema, scouterNameSchema } from "./scouter.schema";

export const SCOUTER_COOKIE = "scouter_cookie_id";
export const SCOUTER_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;

export type ScouterNameInput = z.infer<typeof scouterNameSchema>;
export type DraftInput = z.infer<typeof draftInputSchema>;

export type ScouterRegistration = {
  scouter_cookie_id: string;
  scouter_name: string;
};