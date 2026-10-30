import { getDatabase, type NotesDatabase } from "@/db/database";
import { createNotesService } from "@/data/service";
import { seedFixture } from "./helpers";

export async function resetSharedDatabase(): Promise<NotesDatabase> {
    const db = getDatabase();
    await db.delete();
    await db.open();
    return db;
}

/**
 * Simulates a returning user: the profile exists and the welcome tour has
 * already been seen, so it never auto-starts and blocks the UI under test.
 */
export async function markTourSeen(db: NotesDatabase): Promise<void> {
    const service = createNotesService(db);
    await service.initialize();
    await service.settings.update({ hasSeenTour: true });
}

/** Fresh database where the welcome tour is already marked as seen. */
export async function seedReturningUser(): Promise<NotesDatabase> {
    const db = await resetSharedDatabase();
    await markTourSeen(db);
    return db;
}

export async function resetAndSeed(): Promise<NotesDatabase> {
    const db = await resetSharedDatabase();
    const service = createNotesService(db);
    await service.initialize();
    await service.settings.update({ hasSeenTour: true });
    await seedFixture(service);
    return db;
}
