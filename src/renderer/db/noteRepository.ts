import { createId } from "@/lib/ids";
import { validationMessage } from "@/lib/validationMessages";
import type { NotesDatabase } from "./database";
import { ValidationError } from "./projectRepository";
import type { NoteRecord } from "./schema";

export interface NoteInput {
    title: string;
    content: string;
    projectId: string | null;
    tags: string[];
    // ─── NEW: set only when the note came from an opened `.txt` / `.md`.
    // Omitted by every other caller, `update` leaves the stored value alone. ───
    sourcePath?: string | null;
}

const MAX_TAGS = 12;

export function normalizeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of tags) {
        const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40);
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(tag);
        if (result.length >= MAX_TAGS) break;
    }
    return result;
}

export function validateNoteInput(input: NoteInput, options: { allowEmpty?: boolean } = {}): NoteInput {
    const title = input.title.trim();
    const content = input.content;
    if (!options.allowEmpty && !title && !content.trim()) {
        throw new ValidationError(
            "title",
            validationMessage("validation.noteEmpty", "Add a title or some content before saving.")
        );
    }
    if (title.length > 200) {
        throw new ValidationError(
            "title",
            validationMessage("validation.noteTitleTooLong", "Title must be 200 characters or fewer.")
        );
    }
    return {
        title: title.slice(0, 200),
        content,
        projectId: input.projectId,
        tags: normalizeTags(input.tags),
        // ─── NEW: `undefined` means "leave whatever is stored", which is what
        // every normal edit wants. ───
        sourcePath: input.sourcePath
    };
}

export function noteRepository(db: NotesDatabase) {
    async function nextOrder(): Promise<number> {
        const rows = await db.notes.toArray();
        return rows.reduce((max, row) => Math.max(max, row.order), -1) + 1;
    }

    return {
        async list(): Promise<NoteRecord[]> {
            return db.notes.toArray();
        },

        async get(id: string): Promise<NoteRecord | undefined> {
            return db.notes.get(id);
        },

        async create(input: NoteInput): Promise<NoteRecord> {
            const data = validateNoteInput(input, { allowEmpty: true });
            const now = new Date().toISOString();
            const record: NoteRecord = {
                id: createId("note"),
                title: data.title,
                content: data.content,
                projectId: data.projectId,
                tags: data.tags,
                pinned: false,
                favorite: false,
                archived: false,
                // ─── NEW: remember the imported file, if any. ───
                sourcePath: data.sourcePath ?? null,
                order: await nextOrder(),
                createdAt: now,
                updatedAt: now
            };
            await db.notes.add(record);
            return record;
        },

        async update(id: string, input: NoteInput): Promise<NoteRecord> {
            const data = validateNoteInput(input);
            const existing = await db.notes.get(id);
            if (!existing) {
                throw new Error(validationMessage("validation.noteGone", "Note no longer exists."));
            }
            const next: NoteRecord = {
                ...existing,
                title: data.title,
                content: data.content,
                projectId: data.projectId,
                tags: data.tags,
                // ─── NEW: only overwrite the origin when the caller supplied one,
                // so a plain edit never forgets where the note came from. ───
                sourcePath: data.sourcePath ?? existing.sourcePath ?? null,
                updatedAt: new Date().toISOString()
            };
            await db.notes.put(next);
            return next;
        },

        // ─── NEW: find the note previously imported from this file. ───
        async findBySourcePath(sourcePath: string): Promise<NoteRecord | undefined> {
            return db.notes.where("sourcePath").equals(sourcePath).first();
        },

        // ─── NEW: open-or-refresh the note for an imported `.txt` / `.md`.
        // Opening the same file twice must not fill the list with duplicates,
        // so a matching note is replaced in place instead of created again. ───
        async importDocument(input: {
            title: string;
            content: string;
            sourcePath: string;
            tags?: string[];
        }): Promise<NoteRecord> {
            const existing = await db.notes.where("sourcePath").equals(input.sourcePath).first();
            const now = new Date().toISOString();
            if (existing) {
                const next: NoteRecord = {
                    ...existing,
                    title: input.title.slice(0, 200),
                    content: input.content,
                    archived: false,
                    updatedAt: now
                };
                await db.notes.put(next);
                return next;
            }
            const record: NoteRecord = {
                id: createId("note"),
                title: input.title.slice(0, 200),
                content: input.content,
                projectId: null,
                tags: normalizeTags(input.tags ?? []),
                pinned: false,
                favorite: false,
                archived: false,
                sourcePath: input.sourcePath,
                order: await nextOrder(),
                createdAt: now,
                updatedAt: now
            };
            await db.notes.add(record);
            return record;
        },

        async setFlag(id: string, flag: "pinned" | "favorite"): Promise<NoteRecord> {
            const existing = await db.notes.get(id);
            if (!existing) {
                throw new Error(validationMessage("validation.noteGone", "Note no longer exists."));
            }
            const next = { ...existing, [flag]: !existing[flag], updatedAt: new Date().toISOString() };
            await db.notes.put(next);
            return next;
        },

        async moveToProject(id: string, projectId: string | null): Promise<NoteRecord> {
            const existing = await db.notes.get(id);
            if (!existing) {
                throw new Error(validationMessage("validation.noteGone", "Note no longer exists."));
            }
            const next = { ...existing, projectId, updatedAt: new Date().toISOString() };
            await db.notes.put(next);
            return next;
        },

        // ─── NEW: archive / restore a note without deleting it. ───
        async setArchived(id: string, archived: boolean): Promise<NoteRecord> {
            const existing = await db.notes.get(id);
            if (!existing) {
                throw new Error(validationMessage("validation.noteGone", "Note no longer exists."));
            }
            const next = { ...existing, archived, updatedAt: new Date().toISOString() };
            await db.notes.put(next);
            return next;
        },

        async reorder(orderedIds: string[]): Promise<NoteRecord[]> {
            const rows = await db.notes.toArray();
            const byId = new Map(rows.map((row) => [row.id, row]));
            const updated: NoteRecord[] = [];
            orderedIds.forEach((id, index) => {
                const row = byId.get(id);
                if (!row) return;
                updated.push({ ...row, order: index });
                byId.delete(id);
            });
            [...byId.values()]
                .sort((a, b) => a.order - b.order)
                .forEach((row, index) => updated.push({ ...row, order: orderedIds.length + index }));
            await db.notes.bulkPut(updated);
            return updated.sort((a, b) => a.order - b.order);
        },

        async remove(id: string): Promise<void> {
            await db.notes.delete(id);
        }
    };
}

export type NoteRepository = ReturnType<typeof noteRepository>;
