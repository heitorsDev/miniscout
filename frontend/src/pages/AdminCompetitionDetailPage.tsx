import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError } from "../lib/api";
import type { Competition, OfficialScore, ScoutGroup, ScoutGroupSummary, ScoutRecord } from "../lib/types";

type State =
  | { status: "loading" }
  | {
      status: "ready";
      competition: Competition;
      groups: ScoutGroupSummary[];
      records: ScoutRecord[];
      officialScores: OfficialScore[];
    }
  | { status: "not_found" }
  | { status: "error"; message: string };

type FormState = {
  match_number: string;
  red_score: string;
  blue_score: string;
  status: "idle" | "saving" | "error";
  message: string;
};

export function AdminCompetitionDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: "loading" });
  const [selected, setSelected] = useState<ScoutGroup | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [scoreForm, setScoreForm] = useState<FormState>({
    match_number: "",
    red_score: "",
    blue_score: "",
    status: "idle",
    message: ""
  });
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const matchNumberOptions = useMemo(() => {
    if (state.status !== "ready") return [] as string[];
    const distinct = new Set(state.groups.map((group) => group.match_number));
    return Array.from(distinct).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.listAdminCompetitions(),
      api.listAdminGroups(id),
      api.listOfficialScores(id).catch(() => ({ official_scores: [] as OfficialScore[] }))
    ])
      .then(async ([competitionsResponse, groupsResponse, officialScoresResponse]) => {
        const competition = competitionsResponse.competitions.find((candidate) => candidate._id === id);
        if (!competition) {
          if (!cancelled) setState({ status: "not_found" });
          return;
        }
        const groupDetails = await Promise.all(groupsResponse.groups.map((group) =>
          api.getAdminGroup(id, group.match_number, group.team_number)
        ));
        if (cancelled) return;
        setSelected((current) => {
          if (!current) return null;
          return groupDetails.find(({ group }) =>
            group.match_number === current.match_number && group.team_number === current.team_number
          )?.group ?? null;
        });
        setState({
          status: "ready",
          competition,
          groups: groupsResponse.groups,
          records: groupDetails.flatMap(({ group }) => group.records),
          officialScores: officialScoresResponse.official_scores
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

  const exportCsv = async () => {
    const response = await fetch("/api/admin/export/records.csv", { method: "POST" });
    if (!response.ok) throw new ApiError("Export failed", response.status);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "records.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleDelete = async (recordId: string) => {
    if (!window.confirm("Delete this ScoutRecord? This cannot be undone.")) return;
    setDeletingId(recordId);
    setDeleteError("");
    try {
      await api.deleteAdminRecord(recordId);
      reload();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : "Could not delete record");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOfficialScoreSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "ready") return;
    const red = Number(scoreForm.red_score);
    const blue = Number(scoreForm.blue_score);
    if (!scoreForm.match_number.trim() || !Number.isInteger(red) || !Number.isInteger(blue)) {
      setScoreForm({ ...scoreForm, status: "error", message: "Match number and integer scores are required" });
      return;
    }
    setScoreForm({ ...scoreForm, status: "saving", message: "" });
    try {
      await api.upsertOfficialScore(state.competition._id, {
        match_number: scoreForm.match_number.trim(),
        red_score: red,
        blue_score: blue
      });
      setScoreForm({
        match_number: "",
        red_score: "",
        blue_score: "",
        status: "idle",
        message: `Saved official score for match ${scoreForm.match_number.trim()}`
      });
      reload();
    } catch (error) {
      setScoreForm({
        ...scoreForm,
        status: "error",
        message: error instanceof ApiError ? error.message : "Could not save official score"
      });
    }
  };

  if (state.status === "loading") return <p className="status">Loading…</p>;
  if (state.status === "not_found") return <p role="alert" className="error">Competition not found.</p>;
  if (state.status === "error") return <p role="alert" className="error">{state.message}</p>;

  return (
    <section className="profile-card">
      <p className="eyebrow">Miniscout Admin</p>
      <h1>{state.competition.name}</h1>
      <p><Link to="/admin/competitions">Back to Competitions</Link></p>

      <div className="qr-block">
        <h2>QR token</h2>
        <p>
          <Link to={`/admin/competitions/${state.competition._id}/qr`}>Open QR full image</Link>
          {" · "}
          <Link to={`/admin/competitions/${state.competition._id}/teams`} data-testid="teams-link">Teams rollup</Link>
        </p>
        <QRCodeSVG value={`${window.location.origin}/scout?c=${state.competition.qr_token}`} size={224} data-testid="competition-qr" />
        <p className="muted">
          Encodes a scouter URL relative to this origin with <code>?c={state.competition.qr_token}</code>.
        </p>
      </div>

      <h2>ScoutRecord groups</h2>
      {state.groups.length === 0 ? <p>No records yet.</p> : (
        <table className="records-table" data-testid="groups-table">
          <thead><tr><th>Match</th><th>Team</th><th>Records</th><th>Multi-scouted</th><th>Aggregated total</th></tr></thead>
          <tbody>
            {state.groups.map((group) => (
              <tr key={`${group.match_number}-${group.team_number}`} data-testid="group-row">
                <td><button type="button" onClick={() => api.getAdminGroup(id, group.match_number, group.team_number).then((result) => setSelected(result.group))}>{group.match_number}</button></td>
                <td>{group.team_number}</td><td>{group.record_count}</td><td>{group.multi_scouted ? "Yes" : "No"}</td><td>{group.aggregated_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selected && (
        <section data-testid="group-detail">
          <h2>Aggregated view</h2>
          <p>Median EstimatedScore total: <strong>{selected.aggregated.total}</strong></p>
          <dl>{Object.entries(selected.aggregated.fields).map(([key, field]) => <div key={key}><dt>{key}</dt><dd>{String(field.value ?? "No consensus")}{field.no_consensus && <strong> — no consensus</strong>}</dd></div>)}</dl>
          <h2>{selected.record_count} individual records</h2>
          <div className="record-columns">{selected.records.map((record) => <article key={record._id} data-testid="record-card"><h3>{record.scouter_name}</h3><pre>{JSON.stringify(record.values, null, 2)}</pre><p>EstimatedScore: {record.estimated_score.total}</p></article>)}</div>
        </section>
      )}

      <div className="records-block">
        <h2>Records <button type="button" onClick={reload}>Refresh</button></h2>
        <button type="button" onClick={exportCsv}>Export CSV</button>
        {deleteError && <p role="alert" className="error">{deleteError}</p>}
        {state.records.length > 0 && (
          <table className="records-table" data-testid="records-table">
            <thead><tr><th>Submitted at</th><th>Match</th><th>Team</th><th>Scouter name</th><th>Actions</th></tr></thead>
            <tbody>{state.records.map((record) => (
              <tr key={record._id} data-testid="record-row">
                <td>{new Date(record.submitted_at).toLocaleString()}</td><td>{record.match_number}</td><td>{record.team_number}</td><td>{record.scouter_name}</td>
                <td><button type="button" data-testid={`delete-record-${record._id}`} onClick={() => handleDelete(record._id)} disabled={deletingId === record._id}>{deletingId === record._id ? "Deleting…" : "Delete"}</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="records-block" data-testid="official-scores-block">
        <h2>Official scores</h2>
        <form onSubmit={handleOfficialScoreSubmit} aria-label="Save official score">
          <div className="control-group">
            <label htmlFor="official-match">Match number</label>
            <input id="official-match" data-testid="official-match-input" list="official-match-options" value={scoreForm.match_number} onChange={(event) => setScoreForm({ ...scoreForm, match_number: event.target.value })} maxLength={20} required />
            <datalist id="official-match-options">
              {matchNumberOptions.map((matchNumber) => <option key={matchNumber} value={matchNumber} />)}
            </datalist>
          </div>
          <div className="inline-controls">
            <div className="control-group" style={{ flex: 1 }}><label htmlFor="official-red">Red score</label><input id="official-red" data-testid="official-red-input" type="number" step={1} value={scoreForm.red_score} onChange={(event) => setScoreForm({ ...scoreForm, red_score: event.target.value })} required /></div>
            <div className="control-group" style={{ flex: 1 }}><label htmlFor="official-blue">Blue score</label><input id="official-blue" data-testid="official-blue-input" type="number" step={1} value={scoreForm.blue_score} onChange={(event) => setScoreForm({ ...scoreForm, blue_score: event.target.value })} required /></div>
          </div>
          <button type="submit" data-testid="official-save" disabled={scoreForm.status === "saving"}>{scoreForm.status === "saving" ? "Saving…" : "Save official score"}</button>
          {scoreForm.message && scoreForm.status === "idle" && <p role="status" className="status">{scoreForm.message}</p>}
          {scoreForm.status === "error" && <p role="alert" className="error">{scoreForm.message}</p>}
        </form>
        {state.officialScores.length === 0 ? <p className="muted">No official scores entered yet.</p> : (
          <table className="records-table" data-testid="official-scores-table">
            <thead><tr><th>Match</th><th>Red</th><th>Blue</th><th>Updated</th></tr></thead>
            <tbody>{state.officialScores.map((score) => <tr key={score._id} data-testid="official-score-row"><td>{score.match_number}</td><td>{score.red_score}</td><td>{score.blue_score}</td><td>{new Date(score.updated_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
