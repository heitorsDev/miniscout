import type { Collection } from "mongodb";
import { BaseBroadcaster } from "./broadcaster";
import type { CompetitionId, MatchBroadcaster } from "./broadcaster";

type MatchBroadcastStateDocument = {
  _id: CompetitionId;
  current_match_number: number | null;
  updated_at: string;
};

export class MongoBroadcaster extends BaseBroadcaster {
  protected readonly entries = new Map<CompetitionId, { value: number | null; updatedAt: string }>();

  private constructor(private readonly collection: Collection<MatchBroadcastStateDocument>) {
    super();
  }

  static async load(collection: Collection<MatchBroadcastStateDocument>): Promise<MongoBroadcaster> {
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
  collection: Collection<MatchBroadcastStateDocument>
): Promise<MatchBroadcaster> {
  return MongoBroadcaster.load(collection);
}
