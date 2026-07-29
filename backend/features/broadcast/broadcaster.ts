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

abstract class BaseBroadcaster implements MatchBroadcaster {
  protected readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  abstract getCurrent(competitionId: CompetitionId): Promise<number | null>;
  abstract setCurrent(
    competitionId: CompetitionId,
    value: number
  ): Promise<{ value: number; updatedAt: string }>;
  abstract clearCurrent(competitionId: CompetitionId): Promise<{ updatedAt: string }>;

  subscribe(competitionId: CompetitionId, handler: MatchEventHandler): Unsubscribe {
    this.emitter.on(competitionId, handler);
    return () => {
      this.emitter.off(competitionId, handler);
    };
  }

  protected emit(event: MatchEvent): void {
    this.emitter.emit(event.competitionId, event);
  }
}

export class InMemoryBroadcaster extends BaseBroadcaster {
  private readonly entries = new Map<CompetitionId, { value: number; updatedAt: string }>();

  async getCurrent(competitionId: CompetitionId): Promise<number | null> {
    return this.entries.get(competitionId)?.value ?? null;
  }

  async setCurrent(
    competitionId: CompetitionId,
    value: number
  ): Promise<{ value: number; updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    this.entries.set(competitionId, { value, updatedAt });
    this.emit({ type: "updated", competitionId, value, updatedAt });
    return { value, updatedAt };
  }

  async clearCurrent(competitionId: CompetitionId): Promise<{ updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    this.entries.delete(competitionId);
    this.emit({ type: "cleared", competitionId, updatedAt });
    return { updatedAt };
  }
}

export function createInMemoryBroadcaster(): MatchBroadcaster {
  return new InMemoryBroadcaster();
}