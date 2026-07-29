# Miniscout — Ubiquitous Language

A minimalist FRC/FTC scouting app: MongoDB + Node/Express + React, packaged in Docker. One active Competition per app install; create fresh per season. Scouters self-organize; admin does config + cleanup + official scores. Multiple scouters can record the same `(match, team)` — flagged and aggregated via median.

## Scoring rules

- Each ScoringProfile field carries `points_per_unit` (counter / number / boolean) or `points_per_option` map (enum). Notes contribute 0.
- A ScoutRecord's **EstimatedScore** = `{ total, by_phase: ..., by_target: ... }`. Computed on-read. Never persisted.
- A multi-scouted **(match, team) group** (≥2 records) is **flagged**. Aggregated view = **median of EstimatedScore totals** across the group's records. Per-record view still inspectable side-by-side. Single-record groups render normally, unflagged.

## Decisions log

### Storage / schema

- _resolved_ **Profile storage** → JSON file. Agent-editable, shared by file copy. Admin UI loads/saves.
- _resolved_ **Field type taxonomy** → 5 types: `counter`, `enum`, `boolean`, `number`, `note`.
- _resolved_ **Phases** → declarative list; fields attach to one phase or `null` (match-level).
- _resolved_ **Profile-edit rule** → fully mutable. Renames silently orphan prior record values.
- _resolved_ **No Match entity.** `match_number`, `team_number` are free-text fields on `ScoutRecord`. No collection, no slot derivation.
- _resolved_ **No Team collection.** `team_number` is a string. No roster.
- _resolved_ **Competition lifecycle** → open-forever.
- _resolved_ **Alliance size** → declared in profile (2 or 3). Informational only.

### Multi-scouting

- _resolved_ **Multiple ScoutRecords per `(competition_id, match_number, team_number)` are allowed.** No unique constraint. Collision-submissions add to the group instead of 409.
- _resolved_ **Group flag** — group with record_count ≥ 2 is flagged "multi-scouted" in admin UI.
- _resolved_ **Aggregated score = median of EstimatedScore.total across the group's records.**
- _resolved_ **UI explicitness** — flagged groups show N records side-by-side (scouter_name, raw values, per-record score) + aggregated median. Single-record groups render normally.

### Scoring

- _resolved_ **Scoring estimate** → on-read, `total + by_phase + by_target` per ScoutRecord.
- _resolved_ **Official match score** → admin-entered `OfficialScore{competition_id, match_number, red_score, blue_score}`.

### Workflow / access

- _resolved_ **Admin UI access** → local-only. Bound to `127.0.0.1`; no password.
- _resolved_ **Scouter entry** → QR encodes competition token in URL. Server issues cookie after name registration (persists name + unsubmitted draft; TTL 7 days).
- _resolved_ **QR rotation** → single-per-comp.
- _resolved_ **Match broadcast** → ephemeral `Competition.current_match_number`. All scouter UIs show it as suggested match_number. Admin-clearable.
- _resolved_ **Scouter flow** → scan QR → name → see current match broadcast + type team_number from observation → fill values → submit. No slot picker.
- _resolved_ **Admin scope** → full CRUD (records, profile, official scores, match broadcast). Routine role: config + cleanup + official scores.

### Defaults (proposing)

- _proposed_ **Cookie TTL** → 7 days.
- _proposed_ **CSV column order** → `competition_id, match_number, team_number, scouter_name, submitted_at, red_score, blue_score, [field keys in profile order…], estimated_score.total`. Raw per-record rows; **flag and median aggregation in a separate second CSV export** (one row per `(match,team)` group with `record_count` and `aggregated_total`).
- _proposed_ **Pre-submit hint** → scouter UI shows count + other scouters' names for `(match, team)` before they submit; frictionless submission either way.

## Defaults needing sign-off

- _proposed_ **Cookie TTL** → 7 days.
- _proposed_ **CSV column order** → `competition_id, match_number, team_number, scouter_name, submitted_at, red_score, blue_score, [field keys in profile order…], estimated_score.total`. Raw per-record rows; **flag and median aggregation in a separate second CSV export** (one row per `(match,team)` group with `record_count` and `aggregated_total`).
- _proposed_ **Pre-submit hint** → scouter UI shows count + other scouters' names for `(match, team)` before they submit; frictionless submission either way.
- _resolved_ **Per-field aggregation rule** (across records in a multi-scout group): counter/number = numeric median; boolean/enum = mode with tie flag "no consensus"; note = concat labelled by scouter. Group score = median of per-record EstimatedScore totals (**direction A**).

## Core terms

- **Competition** — Season-scoped container. Owns ScoringProfile (file path), `current_match_number` (ephemeral), OfficialScores, ScoutRecords. One per season.
- **ScoringProfile** — JSON file. Phase list, alliance-size declaration (informational), field list. Each field: `key`, `label`, `type`, `phase?`, `scoring_target?`, `points_per_*`.
- **ScoutRecord** — `{competition_id, match_number, team_number, scouter_name, scouter_cookie_id, values, submitted_at}`. EstimatedScore derived. Multiple allowed per `(match, team)`.
- **Group** — Set of ScoutRecords sharing `(competition_id, match_number, team_number)`. Flagged when count ≥ 2.
- **OfficialScore** — `{competition_id, match_number, red_score, blue_score}`. Admin-entered.
- **Scouter** — Cookie-held display name + cookie id. One cookie submits many records.
- **Admin** — Docker-pc local user. Full data access.

## Invariants

- EstimatedScore never persisted.
- Admin UI never accepts untrusted-network clients.
- QR token is opaque; whoever scans it can submit records under that Competition.
- Profile is the canonical schema; ScoutRecord values reference field `key`s — orphan values drop silently on read.
- Group flag = `record_count ≥ 2`; aggregation only meaningful for groups.
