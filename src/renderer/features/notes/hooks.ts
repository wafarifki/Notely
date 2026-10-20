import { useCallback, useState } from "react";
import { describeError, useStore } from "@/app/store";
import { useToast } from "@/components/Toasts";
import type { NoteInput } from "@/db/noteRepository";
import type { NoteRecord } from "@/db/schema";

export function useNoteActions() {
    const { service, notes, refresh } = useStore();
    const toast = useToast();
    const [pending, setPending] = useState(false);

    const createNote = useCallback(
        async (values: NoteInput): Promise<NoteRecord | null> => {
            setPending(true);
            try {
                const note = await service.createNote(values);
                toast.success("Note created.");
                return note;
            } catch (error) {
                toast.error(describeError(error));
                return null;
            } finally {
                setPending(false);
            }
        },
        [service, toast]
    );

    const deleteNote = useCallback(
        async (id: string) => {
            try {
                await service.deleteNote(id);
                toast.success("Note deleted.");
            } catch (error) {
                toast.error(describeError(error));
                throw error;
            }
        },
        [service, toast]
    );

    const toggleFlag = useCallback(
        async (id: string, flag: "pinned" | "favorite") => {
            const note = notes.find((row) => row.id === id);
            try {
                await service.toggleNoteFlag(id, flag);
                const nextState = note?.[flag] ? "removed" : "added";
                toast.success(flag === "pinned" ? `Note ${nextState} from pinned.` : `Note ${nextState} to favorites.`);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [notes, service, toast]
    );

    const moveNote = useCallback(
        async (id: string, projectId: string | null) => {
            try {
                await service.moveNote(id, projectId);
                toast.success(projectId ? "Note moved to project." : "Note moved to Unassigned.");
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [service, toast]
    );

    const reorderNotes = useCallback(
        async (orderedIds: string[]) => {
            try {
                await service.reorderNotes(orderedIds);
            } catch (error) {
                toast.error(describeError(error));
                refresh();
            }
        },
        [service, toast, refresh]
    );

    return { pending, createNote, deleteNote, toggleFlag, moveNote, reorderNotes };
}
