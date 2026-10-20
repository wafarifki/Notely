import { useCallback, useMemo, useState } from "react";
import type { NoteRecord, ProjectRecord } from "@/db/schema";
import { sortNotes } from "@/db/schema";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { NoteCard } from "./NoteCard";
import { NoteMenu, type NoteMenuActions } from "./NoteMenu";

export interface NotesColumnHandlers {
    onOpen(note: NoteRecord): void;
    onDelete(note: NoteRecord): void;
    onToggleFlag(note: NoteRecord, flag: "pinned" | "favorite"): void;
    onMove(note: NoteRecord, projectId: string | null): void;
    onSelectTag(tag: string): void;
    onReorder(orderedIds: string[]): void;
}

export function NotesColumn({
    notes,
    projects,
    handlers,
    limit = 4,
    dragEnabled = false,
    className = "",
    showcase = false
}: {
    notes: NoteRecord[];
    projects: ProjectRecord[];
    handlers: NotesColumnHandlers;
    limit?: number;
    dragEnabled?: boolean;
    className?: string;
    showcase?: boolean;
}) {
    const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
    const ordered = useMemo(() => sortNotes(notes), [notes]);
    const visible = useMemo(() => {
        if (limit >= ordered.length) return ordered;
        const firstFallback = ordered.slice(0, limit);
        if (firstFallback.length > 2 && !firstFallback[2].tags.length) {
            const withTags = ordered.find((note) => note.tags.length > 0 && !firstFallback.includes(note));
            if (withTags) firstFallback[2] = withTags;
        }
        return firstFallback;
    }, [ordered, limit]);

    const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [targetIndex, setTargetIndex] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<NoteRecord | null>(null);

    const menuNote = notes.find((note) => note.id === menuNoteId) ?? null;
    const closeMenu = useCallback(() => {
        setMenuNoteId(null);
        setMenuAnchor(null);
    }, []);

    const menuActions: NoteMenuActions | null = menuNote
        ? {
              onOpen: () => handlers.onOpen(menuNote),
              onTogglePin: () => handlers.onToggleFlag(menuNote, "pinned"),
              onToggleFavorite: () => handlers.onToggleFlag(menuNote, "favorite"),
              onMove: (projectId) => handlers.onMove(menuNote, projectId),
              onSelectTag: handlers.onSelectTag,
              onDelete: () => setDeleteTarget(menuNote)
          }
        : null;

    function finishDrag(commit: boolean) {
        const from = ordered.findIndex((note) => note.id === draggingId);
        setDraggingId(null);
        setTargetIndex(null);
        if (!commit || from === -1 || targetIndex === null || from === targetIndex) return;
        const next = [...ordered];
        const [moved] = next.splice(from, 1);
        next.splice(targetIndex, 0, moved);
        handlers.onReorder(next.map((note) => note.id));
    }

    return (
        <div
            className={`notes-grid${draggingId ? " is-sorting" : ""}${showcase ? " is-showcase" : ""}${className ? ` ${className}` : ""}`}
        >
            {visible.map((note, index) => (
                <div
                    key={note.id}
                    className={`note-grid-cell${showcase && index === 2 ? " is-showcase-target" : ""}`}
                    style={showcase && index === 2 ? { zIndex: 3 } : undefined}
                >
                    {showcase && index === 2 ? (
                        <div className="drop-slot drop-slot-note drop-slot-showcase" aria-hidden="true" />
                    ) : null}
                    {targetIndex === index && draggingId ? (
                        <div className="drop-slot drop-slot-note" aria-hidden="true" />
                    ) : null}
                    <NoteCard
                        note={note}
                        project={note.projectId ? projectMap.get(note.projectId) : undefined}
                        draggable={dragEnabled}
                        elevated={showcase && index === 2}
                        dragMode={showcase && index === 2}
                        dragging={draggingId === note.id}
                        menuOpen={menuNoteId === note.id}
                        className={targetIndex === index && draggingId ? "is-drag-origin" : ""}
                        onOpen={() => handlers.onOpen(note)}
                        onMenu={(anchor) => {
                            if (menuNoteId === note.id) {
                                closeMenu();
                                return;
                            }
                            setMenuNoteId(note.id);
                            setMenuAnchor(anchor);
                        }}
                        onSelectTag={handlers.onSelectTag}
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", note.id);
                            setDraggingId(note.id);
                            setTargetIndex(index);
                        }}
                        onDragOver={(event) => {
                            if (!draggingId) return;
                            event.preventDefault();
                            if (targetIndex !== index) setTargetIndex(index);
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            finishDrag(true);
                        }}
                        onDragEnd={() => finishDrag(true)}
                    />
                </div>
            ))}
            {menuNote && menuActions ? (
                <NoteMenu
                    open
                    anchor={menuAnchor}
                    note={menuNote}
                    projects={projects}
                    actions={menuActions}
                    onClose={closeMenu}
                />
            ) : null}
            <DeleteConfirm
                open={Boolean(deleteTarget)}
                subject="note"
                detail={deleteTarget ? `“${deleteTarget.title || "Untitled note"}” will be removed.` : undefined}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (deleteTarget) handlers.onDelete(deleteTarget);
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
}
