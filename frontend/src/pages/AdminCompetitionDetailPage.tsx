import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import type { Competition, ScoutGroup, ScoutGroupSummary } from "../lib/types";

type State = { status: "loading" } | { status: "ready"; competition: Competition; groups: ScoutGroupSummary[] } | { status: "error" };

export function AdminCompetitionDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: "loading" });
  const [selected, setSelected] = useState<ScoutGroup | null>(null);
  useEffect(() => {
    Promise.all([api.listAdminCompetitions(), api.listAdminGroups(id)])
      .then(([competitions, groups]) => {
        const competition = competitions.competitions.find((item) => item._id === id);
        setState(competition ? { status: "ready", competition, groups: groups.groups } : { status: "error" });
      }).catch(() => setState({ status: "error" }));
  }, [id]);
  if (state.status === "loading") return <p className="status">Loading…</p>;
  if (state.status === "error") return <p role="alert" className="error">Competition not found.</p>;
  return <section className="profile-card">
    <p className="eyebrow">Miniscout Admin</p><h1>{state.competition.name}</h1>
    <QRCodeSVG value={`${window.location.origin}/scout?c=${state.competition.qr_token}`} size={160} data-testid="competition-qr" />
    <p><Link to="/admin/competitions">Back to Competitions</Link></p>
    <h2>ScoutRecord groups</h2>
    {state.groups.length === 0 ? <p>No records yet.</p> : <table className="records-table" data-testid="groups-table"><thead><tr><th>Match</th><th>Team</th><th>Records</th><th>Multi-scouted</th><th>Aggregated total</th></tr></thead><tbody>
      {state.groups.map((group) => <tr key={`${group.match_number}-${group.team_number}`} data-testid="group-row"><td><button type="button" onClick={() => api.getAdminGroup(id, group.match_number, group.team_number).then((result) => setSelected(result.group))}>{group.match_number}</button></td><td>{group.team_number}</td><td>{group.record_count}</td><td>{group.multi_scouted ? "Yes" : "No"}</td><td>{group.aggregated_total}</td></tr>)}
    </tbody></table>}
    {selected && <section data-testid="group-detail"><h2>Aggregated view</h2><p>Median EstimatedScore total: <strong>{selected.aggregated.total}</strong></p>
      <dl>{Object.entries(selected.aggregated.fields).map(([key, field]) => <div key={key}><dt>{key}</dt><dd>{String(field.value ?? "No consensus")}{field.no_consensus && <strong> — no consensus</strong>}</dd></div>)}</dl>
      <h2>{selected.record_count} individual records</h2><div className="record-columns">{selected.records.map((record) => <article key={record._id} data-testid="record-card"><h3>{record.scouter_name}</h3><pre>{JSON.stringify(record.values, null, 2)}</pre><p>EstimatedScore: {record.estimated_score.total}</p></article>)}</div>
    </section>}
  </section>;
}
