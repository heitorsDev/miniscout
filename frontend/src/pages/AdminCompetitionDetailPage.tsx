import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError } from "../lib/api";
import type { Competition, ScoutRecord } from "../lib/types";

type State =
  | { status: "loading" }
  | { status: "ready"; competition: Competition; records: ScoutRecord[]; qrUrl: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function AdminCompetitionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([api.listAdminCompetitions(), id ? api.listAdminRecords(id).catch(() => ({ records: [] as ScoutRecord[] })) : Promise.resolve({ records: [] as ScoutRecord[] })])
      .then(([competitionsResponse, recordsResponse]) => {
        if (cancelled) return;
        const competition = competitionsResponse.competitions.find((candidate) => candidate._id === id);
        if (!competition) {
          setState({ status: "not_found" });
          return;
        }
        const qrUrl = `?c=${competition.qr_token}`;
        setState({
          status: "ready",
          competition,
          records: recordsResponse.records,
          qrUrl
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: error instanceof ApiError ? error.message : "Could not load competition" });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (state.status === "loading") {
    return (
      <section className="profile-card">
        <p className="status">Loading…</p>
      </section>
    );
  }

  if (state.status === "not_found") {
    return (
      <section className="profile-card">
        <p role="alert" className="error">Competition not found.</p>
        <Link to="/admin/competitions">Back to Competitions</Link>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="profile-card">
        <p role="alert" className="error">{state.message}</p>
      </section>
    );
  }

  return (
    <section className="profile-card" aria-labelledby="detail-title">
      <p className="eyebrow">Miniscout Admin</p>
      <h1 id="detail-title">{state.competition.name}</h1>
      <p className="intro">
        Profile <code>{state.competition.scoring_profile_name}</code> · minted {new Date(state.competition.created_at).toLocaleString()}
      </p>

      <div className="qr-block">
        <h2>QR token</h2>
        <p>
          <Link to={`/admin/competitions/${state.competition._id}/qr`}>Open QR full image</Link>
        </p>
        <QRCodeSVG value={`${window.location.origin}${state.qrUrl}`} size={224} data-testid="competition-qr" />
        <p className="muted">
          Encodes a scouter URL relative to this origin with <code>?c={state.competition.qr_token}</code>.
        </p>
      </div>

      <div className="records-block">
        <h2>
          Records <button type="button" onClick={reload}>Refresh</button>
        </h2>
        {state.records.length === 0 ? (
          <p className="muted">No records yet.</p>
        ) : (
          <table className="records-table" data-testid="records-table">
            <thead>
              <tr>
                <th scope="col">Submitted at</th>
                <th scope="col">Match</th>
                <th scope="col">Team</th>
                <th scope="col">Scouter name</th>
              </tr>
            </thead>
            <tbody>
              {state.records.map((record) => (
                <tr key={record._id} data-testid="record-row">
                  <td>{new Date(record.submitted_at).toLocaleString()}</td>
                  <td>{record.match_number}</td>
                  <td>{record.team_number}</td>
                  <td>{record.scouter_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
