import type { NotesDatabase } from "./database";
import type { ActivityInput, ActivityRecord } from "./schema";

const MAX_RETAINED = 500;

export const NICK_DEFAULT_ACTOR = { id: "nick-woods", name: "Nick Woods" } as const;

export function activityRepository(db: NotesDatabase) {
    return {
        async list(limit = 40): Promise<ActivityRecord[]> {
            return db.activity.orderBy("createdAt").reverse().limit(limit).toArray();
        },

        async add(input: ActivityInput): Promise<ActivityRecord> {
            const record: ActivityRecord = {
                id: `activity-${crypto.randomUUID()}`,
                actorId: input.actorId ?? NICK_DEFAULT_ACTOR.id,
                actorName: input.actorName ?? NICK_DEFAULT_ACTOR.name,
                // ─── NEW: persist the actor's uploaded photo, if any. ───
                actorImage: input.actorImage ?? null,
                kind: input.kind,
                entityType: input.entityType,
                entityId: input.entityId,
                title: input.title.trim() || "Untitled",
                projectId: input.projectId ?? null,
                createdAt: input.createdAt ?? new Date().toISOString()
            };
            await db.activity.add(record);
            const total = await db.activity.count();
            if (total > MAX_RETAINED) {
                const oldest = await db.activity.orderBy("createdAt").limit(total - MAX_RETAINED).toArray();
                await db.activity.bulkDelete(oldest.map((row) => row.id));
            }
            return record;
        },

        async removeForEntity(entityId: string): Promise<void> {
            await db.activity.where("entityId").equals(entityId).delete();
        },

        async removeMany(entityIds: string[]): Promise<void> {
            if (entityIds.length === 0) return;
            await db.activity.where("entityId").anyOf(entityIds).delete();
        },

        // ─── NEW: the Recent Activity page can wipe the whole history without
        // touching projects, notes or tasks. ───
        async clear(): Promise<void> {
            await db.activity.clear();
        }
    };
}

export type ActivityRepository = ReturnType<typeof activityRepository>;
