import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError } from "../lib/api";
import type { Competition } from "../lib/types";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; competitions: Competition[] }
  | { status: "error"; message: string };

type CreateState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "submitted"; competition: Competition; qr_url: string }
  | { status: "error"; message: string };

export function AdminCompetitionsPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [createState, setCreateState] = useState<CreateState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    api.listAdminCompetitions()
      .then((response) => {
        if (cancelled) return;
        setLoadState({ status: "ready", competitions: response.competitions });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState({ status: "error", message: error instanceof Error ? error.message : "Could not load competitions" });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const scoring_profile_name = String(formData.get("scoring_profile_name") ?? "").trim();
    const lan_base_url = String(formData.get("lan_base_url") ?? "").trim();
    if (!name || !scoring_profile_name || !lan_base_url) {
      return;
    }
    setCreateState({ status: "submitting" });
    api.mintCompetition({ name, scoring_profile_name, lan_base_url })
      .then((response) => {
        setCreateState({ status: "submitted", competition: response.competition, qr_url: response.qr_url });
        reload();
        (event.target as HTMLFormElement).reset();
      })
      .catch((error: unknown) => {
        const message = error instanceof ApiError ? error.message : "Could not mint competition";
        setCreateState({ status: "error", message });
      });
  };

  return (
    <section className="profile-card" aria-labelledby="competitions-title">
      <p className="eyebrow">Miniscout Admin</p>
      <h1 id="competitions-title">Competitions</h1>
      <p className="intro">Mint a new Competition. The minted record gets a QR that scouters scan.</p>

      <form onSubmit={handleSubmit} aria-label="Mint competition">
        <div className="control-group">
          <label htmlFor="competition-name">Competition name</label>
          <input id="competition-name" name="name" required maxLength={120} />
        </div>
        <div className="control-group">
          <label htmlFor="competition-profile">ScoringProfile name</label>
          <input id="competition-profile" name="scoring_profile_name" required maxLength={120} />
        </div>
        <div className="control-group">
          <label htmlFor="competition-url">LAN scouter URL</label>
          <input
            id="competition-url"
            name="lan_base_url"
            type="url"
            required
            placeholder="http://192.168.1.10:8082"
          />
        </div>
        <button type="submit" disabled={createState.status === "submitting"}>
          {createState.status === "submitting" ? "Minting…" : "Mint competition"}
        </button>
      </form>

      {createState.status === "submitted" && (
        <section aria-labelledby="qr-title" data-testid="qr-section">
          <h2 id="qr-title">Latest minted Competition</h2>
          <p>
            <Link to={`/admin/competitions/${createState.competition._id}`}>
              {createState.competition.name}
            </Link>{" "}
            — QR URL <code>{createState.qr_url}</code>
          </p>
          <QRCodeSVG value={createState.qr_url} size={192} data-testid="qr-svg" />
        </section>
      )}
      {createState.status === "error" && <p role="alert" className="error">{createState.message}</p>}

      <h2>All competitions</h2>
      {loadState.status === "loading" && <p className="status">Loading…</p>}
      {loadState.status === "error" && <p role="alert" className="error">{loadState.message}</p>}
      {loadState.status === "ready" && loadState.competitions.length === 0 && (
        <p className="muted">No Competitions yet. Mint one above.</p>
      )}
      {loadState.status === "ready" && loadState.competitions.length > 0 && (
        <table className="records-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Profile</th>
              <th scope="col">Minted</th>
            </tr>
          </thead>
          <tbody>
            {loadState.competitions.map((competition) => (
              <tr key={competition._id}>
                <td>
                  <Link to={`/admin/competitions/${competition._id}`}>
                    {competition.name}
                  </Link>
                </td>
                <td>{competition.scoring_profile_name}</td>
                <td>{new Date(competition.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
