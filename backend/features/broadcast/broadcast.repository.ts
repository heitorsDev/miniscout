import { EventEmitter } from "node:events";
import type { Collection } from "mongodb";
import type { CompetitionId, MatchBroadcaster, MatchEvent, MatchEventHandler, Unsubscribe } from "./broadcaster";

type CompetitionDocument = {
  _id: CompetitionId;
  current_match_number: number | null;
  updated_at: string;
};

abstract class MongoBackedBroadcaster implements MatchBroadcaster {
  protected readonly emitter = new EventEmitter();
  protected readonly entries = new Map<CompetitionId, { value: number | null; updatedAt: string }>();

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

export class MongoBroadcaster extends MongoBackedBroadcaster {
  private constructor(private readonly collection: Collection<CompetitionDocument>) {
    super();
  }

  static async load(collection: Collection<CompetitionDocument>): Promise<MongoBroadcaster> {
    const broadcaster = new MongoBroadcaster(collection);
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

export async function loadMongoBroadcaster(
  collection: Collection<CompetitionDocument>
): Promise<MatchBroadcaster> {
  return MongoBroadcaster.load(collection);
}