import { NotesDatabase } from "@/db/database";
import { createNotesService } from "@/data/service";

let counter = 0;

export function createTestDatabase(): NotesDatabase {
    counter += 1;
    return new NotesDatabase(`notes-test-${counter}-${Date.now()}`);
}

export async function createSeededService(now: Date = new Date()) {
    const db = createTestDatabase();
    const service = createNotesService(db);
    await service.initialize();
    void now;
    return { db, service };
}
