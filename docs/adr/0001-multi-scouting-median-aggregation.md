# Multi-scouting with median aggregation

We allow multiple ScoutRecords per `(competition_id, match_number, team_number)` instead of the obvious first-wins slot uniqueness, and aggregate their EstimatedScore totals via median in admin views and CSV. This is deliberate: a single scouter can't watch all six robots across a 12-second autonomous period or a 150-second teleop — independent observer agreement is valuable. Per-field disagreement (boolean/enum) is resolved by mode with a "no consensus" flag when the mode is tied, and notes are concatenated by scouter. Profile fields stay fully mutable; renames silently orphan prior values (acceptable risk for the minimalist scope).

Status: proposed.
