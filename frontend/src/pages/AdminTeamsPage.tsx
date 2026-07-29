import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { Competition, TeamRollup } from "../lib/types";

type State =
  | { status: "loading" }
  | { status: "ready"; competition: Competition; teams: TeamRollup[] }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function AdminTeamsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.listAdminCompetitions(),
      id ? api.listAdminTeams(id).catch(() => ({ teams: [] as TeamRollup[] })) : Promise.resolve({ teams: [] as TeamRollup[] })
    ])
      .then(([competitionsResponse, teamsResponse]) => {
        if (cancelled) return;
        const competition = competitionsResponse.competitions.find((candidate) => candidate._id === id);
        if (!competition) {
          setState({ status: "not_found" });
          return;
        }
        setState({
          status: "ready",
          competition,
          teams: teamsResponse.teams
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: error instanceof ApiError ? error.message : "Could not load teams" });
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
    <section className="profile-card" aria-labelledby="teams-title">
      <p className="eyebrow">Miniscout Admin</p>
      <h1 id="teams-title">Teams — {state.competition.name}</h1>
      <p className="intro">
        Per team, across all matches in this Competition: record count, scouted match list, and median aggregated score per match.
      </p>
      <button type="button" onClick={reload}>Refresh</button>
      <p>
        <Link to={`/admin/competitions/${state.competition._id}`}>Back to competition</Link>
      </p>
      {state.teams.length === 0 ? (
        <p className="muted">No teams have been scouted yet.</p>
      ) : (
        <table className="records-table" data-testid="teams-table">
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">Records</th>
              <th scope="col">Matches scouted</th>
              <th scope="col">Per-match median score</th>
            </tr>
          </thead>
          <tbody>
            {state.teams.map((team) => (
              <tr key={team.team_number} data-testid="team-row">
                <td>{team.team_number}</td>
                <td>{team.record_count}</td>
                <td>{team.matches_scouted.join(", ")}</td>
                <td>
                  <ul className="team-matches-list">
                    {team.matches.map((match) => (
                      <li key={match.match_number} data-testid="team-match-row">
                        <code>{match.match_number}</code>: {match.record_count} rec · median {match.median_estimated_score}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}