import type { z } from "zod";
import type { styleProfileSchema } from "./style-profile.schema";

export type StyleProfile = z.infer<typeof styleProfileSchema>;

export type StyleProfileValidationError = {
  path: string;
  message: string;
  code: string;
};

export type StyleProfileValidationResult =
  | { success: true; data: StyleProfile }
  | { success: false; errors: StyleProfileValidationError[] };
