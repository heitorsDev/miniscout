import { useEffect, useState } from "react";
import { AdminMatchBroadcastPanel } from "./AdminMatchBroadcastPanel";

type ValidationError = {
  path: string;
  message: string;
};

type ApiError = {
  error?: string;
  errors?: ValidationError[];
};

type MatchSnapshot = {
  current_match_number: number | null;
  updated_at: string | null;
};

const COMPETITION_ID = "default";

function formatDiff(profile: unknown): string {
  return JSON.stringify(profile, null, 2)
    .split("\n")
    .map((line) => `+ ${line}`)
    .join("\n");
}

async function parseResponse(response: Response): Promise<unknown> {
  const body = await response.json() as ApiError | unknown;
  if (!response.ok) {
    const apiError = body as ApiError;
    const details = apiError.errors?.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(details || apiError.error || "Request failed");
  }
  return body;
}

export function AdminProfilePage() {
  const [profileName, setProfileName] = useState("");
  const [draftProfile, setDraftProfile] = useState<unknown>(null);
  const [fetchedProfile, setFetchedProfile] = useState<unknown>(null);
  const [diffPreview, setDiffPreview] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");
  const [matchSnapshot, setMatchSnapshot] = useState<MatchSnapshot>({
    current_match_number: null,
    updated_at: null
  });

  useEffect(() => {
    fetch(`/api/scouter/competition/${COMPETITION_ID}`)
      .then((response) => response.ok ? response.json() as Promise<{ current_match_number: number | null; updated_at?: string }> : null)
      .then((data) => {
        if (!data) {
          return;
        }
        setMatchSnapshot({
          current_match_number: data.current_match_number,
          updated_at: data.updated_at ?? null
        });
      })
      .catch(() => {
        // tolerate; SSE will sync state once connected
      });
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setStatus("");
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as { name?: unknown };
      setDraftProfile(parsed);
      if (typeof parsed.name === "string") {
        setProfileName(parsed.name);
      }
      setDiffPreview(formatDiff(parsed));
    } catch {
      setDraftProfile(null);
      setDiffPreview("");
      setError("Selected file must contain valid JSON");
    }
  };

  const uploadProfile = async () => {
    if (!draftProfile) {
      setError("Choose Profile JSON file first");
      return;
    }

    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draftProfile)
      });
      const saved = await parseResponse(response);
      setFetchedProfile(saved);
      setStatus("Profile saved");
      setDiffPreview(formatDiff(saved));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Profile upload failed");
    }
  };

  const fetchProfile = async () => {
    const name = profileName.trim();
    if (!name) {
      setError("Enter Profile name first");
      return;
    }

    setStatus("");
    setError("");
    try {
      const response = await fetch(`/api/admin/profiles/${encodeURIComponent(name)}`);
      const profile = await parseResponse(response);
      setFetchedProfile(profile);
      setStatus("Profile fetched");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Profile fetch failed");
    }
  };

  const exportCsv = async () => {
    setExportStatus("");
    setExportError("");
    try {
      const response = await fetch("/api/admin/export/records.csv", { method: "POST" });
      if (!response.ok) {
        let detail = "Export failed";
        try {
          const body = await response.json() as ApiError;
          detail = body.error ?? detail;
        } catch {
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "records.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setExportStatus("Records CSV downloaded");
    } catch (downloadError) {
      setExportError(downloadError instanceof Error ? downloadError.message : "Export failed");
    }
  };

  return (
    <main className="admin-shell">
      <section className="profile-card" aria-labelledby="profile-title">
        <p className="eyebrow">Miniscout Admin</p>
        <h1 id="profile-title">Profile</h1>
        <p className="intro">Upload canonical ScoringProfile JSON or fetch persisted Profile by name.</p>

        <div className="control-group">
          <label htmlFor="profile-file">Profile JSON file</label>
          <input id="profile-file" type="file" accept="application/json,.json" onChange={handleFileChange} />
        </div>
        <button type="button" onClick={uploadProfile}>Upload profile</button>
        <button type="button" onClick={exportCsv}>Export CSV</button>

        {exportStatus && <p role="status" className="status">{exportStatus}</p>}
        {exportError && <p role="alert" className="error">{exportError}</p>}

        <div className="control-group fetch-group">
          <label htmlFor="profile-name">Profile name</label>
          <div className="inline-controls">
            <input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
            <button type="button" onClick={fetchProfile}>Fetch profile</button>
          </div>
        </div>

        {status && <p role="status" className="status">{status}</p>}
        {error && <p role="alert" className="error">{error}</p>}

        {diffPreview && (
          <section aria-labelledby="diff-title">
            <h2 id="diff-title">Diff preview</h2>
            <pre data-testid="diff-preview" className="json-preview diff-preview">{diffPreview}</pre>
          </section>
        )}

        {fetchedProfile !== null && (
          <section aria-labelledby="fetched-title">
            <h2 id="fetched-title">Fetched Profile</h2>
            <pre data-testid="fetched-profile" className="json-preview">{JSON.stringify(fetchedProfile, null, 2)}</pre>
          </section>
        )}

        <AdminMatchBroadcastPanel snapshot={matchSnapshot} onChange={setMatchSnapshot} />
      </section>
    </main>
  );
}
