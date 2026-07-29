import { useEffect, useRef, useState } from "react";

const COMPETITION_ID = "default";

type MatchSnapshot = {
  current_match_number: number | null;
  updated_at: string | null;
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

type AdminMatchBroadcastPanelProps = {
  snapshot: MatchSnapshot;
  onChange: (snapshot: MatchSnapshot) => void;
};

export function AdminMatchBroadcastPanel({ snapshot, onChange }: AdminMatchBroadcastPanelProps) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sseState, setSseState] = useState<"idle" | "open" | "closed">("idle");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/scouter/competition/${COMPETITION_ID}/stream`);
    sourceRef.current = source;
    const handler = (event: Event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as MatchSnapshot & { updated_at: string };
        onChange({ current_match_number: payload.current_match_number, updated_at: payload.updated_at });
      } catch {
        // ignore
      }
    };
    source.addEventListener("match-number", handler);
    source.onopen = () => setSseState("open");
    source.onerror = () => setSseState("closed");
    return () => {
      source.close();
    };
  }, [onChange]);

  const setMatchNumber = async () => {
    const trimmed = input.trim();
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a positive integer match number");
      setStatus("");
      return;
    }
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/competition/${COMPETITION_ID}/match-number`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Override failed (${response.status})`);
      }
      const data = await response.json() as MatchSnapshot & { updated_at: string };
      onChange({ current_match_number: data.current_match_number, updated_at: data.updated_at });
      setStatus(`Set current match to ${value}`);
      setInput(String(value));
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "Override failed");
    }
  };

  const clearMatchNumber = async () => {
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/competition/${COMPETITION_ID}/match-number`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Clear failed (${response.status})`);
      }
      const data = await response.json() as MatchSnapshot & { updated_at: string };
      onChange({ current_match_number: data.current_match_number, updated_at: data.updated_at });
      setStatus("Cleared current match broadcast");
      setInput("");
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Clear failed");
    }
  };

  return (
    <section className="broadcast-panel" aria-labelledby="broadcast-title">
      <h2 id="broadcast-title">Current match broadcast</h2>
      <p className="intro">
        Last broadcast scouters see live: <strong data-testid="admin-current-match">
          {snapshot.current_match_number ?? "none"}
        </strong> at {formatTimestamp(snapshot.updated_at)}. Stream is {sseState}.
      </p>
      <div className="control-group inline-row">
        <label htmlFor="admin-match-input">Override current match</label>
        <div className="inline-controls">
          <input
            id="admin-match-input"
            data-testid="admin-match-input"
            type="number"
            min={1}
            step={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={snapshot.current_match_number !== null ? String(snapshot.current_match_number) : ""}
          />
          <button type="button" data-testid="admin-set-match" onClick={setMatchNumber}>Set</button>
          <button type="button" data-testid="admin-clear-match" onClick={clearMatchNumber}>Clear</button>
        </div>
      </div>
      {status && <p role="status" className="status">{status}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}
