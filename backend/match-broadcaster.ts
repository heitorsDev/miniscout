import { EventEmitter } from "node:events";
import type { Collection } from "mongodb";

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

abstract class BaseMatchBroadcaster implements MatchBroadcaster {
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

export class InMemoryMatchBroadcaster extends BaseMatchBroadcaster {
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

type CompetitionDocument = {
  _id: CompetitionId;
  current_match_number: number | null;
  updated_at: string;
};

export class MongoMatchBroadcaster extends BaseMatchBroadcaster {
  private readonly entries = new Map<CompetitionId, { value: number | null; updatedAt: string }>();

  private constructor(private readonly collection: Collection<CompetitionDocument>) {
    super();
  }

  static async load(collection: Collection<CompetitionDocument>): Promise<MongoMatchBroadcaster> {
    const broadcaster = new MongoMatchBroadcaster(collection);
    const docs = await collection.find({}).toArray();
    for (const doc of docs) {
      broadcaster.entries.set(doc._id, { value: doc.current_match_number, updatedAt: doc.updated_at });
    }
    return broadcaster;
  }

  async getCurrent(competitionId: CompetitionId): Promise<number | null> {
    return this.entries.get(competitionId)?.value ?? null;
  }

  async setCurrent(
    competitionId: CompetitionId,
    value: number
  ): Promise<{ value: number; updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    await this.collection.updateOne(
      { _id: competitionId },
      {
        $set: {
          current_match_number: value,
          updated_at: updatedAt
        }
      },
      { upsert: true }
    );
    this.entries.set(competitionId, { value, updatedAt });
    this.emit({ type: "updated", competitionId, value, updatedAt });
    return { value, updatedAt };
  }

  async clearCurrent(competitionId: CompetitionId): Promise<{ updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    await this.collection.updateOne(
      { _id: competitionId },
      {
        $set: {
          current_match_number: null,
          updated_at: updatedAt
        }
      },
      { upsert: true }
    );
    this.entries.set(competitionId, { value: null, updatedAt });
    this.emit({ type: "cleared", competitionId, updatedAt });
    return { updatedAt };
  }
}
