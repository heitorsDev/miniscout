import path from "node:path";

export function profilePath(profileStoragePath: string, name: string): string {
  const storagePath = path.resolve(profileStoragePath);
  const candidate = path.resolve(storagePath, `${name}.json`);
  if (!candidate.startsWith(`${storagePath}${path.sep}`)) {
    throw new Error("Profile path escapes storage directory");
  }
  return candidate;
}
