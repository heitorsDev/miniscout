import { EventEmitter } from "node:events";

export type CompetitionId = string;

export type MatchEvent =
  | { type: "updated"; competitionId: CompetitionId; value: number; updatedAt: string }
  | { type: "cleared"; competitionId: CompetitionId; updatedAt: string };

export type MatchEventHandler = (event: MatchEvent) => void;
export type Unsubscribe = () => void;

export type MatchBroadcaster = {
  getCurrent(competitionId: CompetitionId): Promise<number | null>;
  setCurrent(competitionId: CompetitionId, value: number): Promise<{ value: number; updatedAt: string }>;
  clearCurrent(competitionId: CompetitionId): Promise<{ updatedAt: string }>;
  subscribe(competitionId: CompetitionId, handler: MatchEventHandler): Unsubscribe;
};

export class InMemoryMatchBroadcaster implements MatchBroadcaster {
  private readonly entries = new Map<CompetitionId, { value: number; updatedAt: string }>();
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  async getCurrent(competitionId: CompetitionId): Promise<number | null> {
    return this.entries.get(competitionId)?.value ?? null;
  }

  async setCurrent(
    competitionId: CompetitionId,
    value: number
  ): Promise<{ value: number; updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    this.entries.set(competitionId, { value, updatedAt });
    this.emitter.emit(competitionId, {
      type: "updated",
      competitionId,
      value,
      updatedAt
    } satisfies MatchEvent);
    return { value, updatedAt };
  }

  async clearCurrent(competitionId: CompetitionId): Promise<{ updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    this.entries.delete(competitionId);
    this.emitter.emit(competitionId, {
      type: "cleared",
      competitionId,
      updatedAt
    } satisfies MatchEvent);
    return { updatedAt };
  }

  subscribe(competitionId: CompetitionId, handler: MatchEventHandler): Unsubscribe {
    this.emitter.on(competitionId, handler);
    return () => {
      this.emitter.off(competitionId, handler);
    };
  }
}
