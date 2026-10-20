import { useEffect, useRef, useState } from "react";
import {
    Check,
    FolderInput,
    Pencil,
    Pin,
    PinOff,
    Star,
    StarOff,
    Trash2
} from "lucide-react";
import { Popover, PopoverDivider, PopoverItem, PopoverLabel } from "@/components/Popover";
import type { NoteRecord, ProjectRecord } from "@/db/schema";
import { sortProjects } from "@/db/schema";

export interface NoteMenuActions {
    onOpen(): void;
    onTogglePin(): void;
    onToggleFavorite(): void;
    onMove(projectId: string | null): void;
    onSelectTag(tag: string): void;
    onDelete(): void;
}

export function NoteMenu({
    open,
    anchor,
    note,
    projects,
    actions,
    onClose
}: {
    open: boolean;
    anchor: HTMLElement | null;
    note: NoteRecord;
    projects: ProjectRecord[];
    actions: NoteMenuActions;
    onClose: () => void;
}) {
    const [showMove, setShowMove] = useState(false);
    const moveTriggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) setShowMove(false);
    }, [open]);

    const run = (action: () => void) => () => {
        onClose();
        action();
    };

    const activeProjects = sortProjects(projects.filter((project) => !project.archived));

    return (
        <Popover open={open} anchor={anchor} onClose={onClose} label="Note actions" width={224}>
            {showMove ? (
                <>
                    <PopoverLabel>Move to</PopoverLabel>
                    <PopoverItem
                        onSelect={run(() => actions.onMove(null))}
                        checked={note.projectId === null}
                    >
                        Unassigned
                    </PopoverItem>
                    {activeProjects.map((project) => (
                        <PopoverItem
                            key={project.id}
                            onSelect={run(() => actions.onMove(project.id))}
                            checked={note.projectId === project.id}
                            icon={<span className="project-dot" data-color={project.color} />}
                        >
                            {project.name}
                        </PopoverItem>
                    ))}
                    <PopoverDivider />
                    <PopoverItem
                        onSelect={() => {
                            moveTriggerRef.current?.focus();
                            setShowMove(false);
                        }}
                    >
                        Back
                    </PopoverItem>
                </>
            ) : (
                <>
                    <PopoverItem onSelect={run(actions.onOpen)} icon={<Pencil size={14} strokeWidth={1.8} />}>
                        Edit note
                    </PopoverItem>
                    <button
                        ref={moveTriggerRef}
                        type="button"
                        role="menuitem"
                        className="popover-item"
                        onClick={() => setShowMove(true)}
                    >
                        <span className="popover-item-icon">
                            <FolderInput size={14} strokeWidth={1.8} />
                        </span>
                        <span className="popover-item-label">Move to project</span>
                    </button>
                    <PopoverItem
                        onSelect={run(actions.onTogglePin)}
                        icon={note.pinned ? <PinOff size={14} strokeWidth={1.8} /> : <Pin size={14} strokeWidth={1.8} />}
                    >
                        {note.pinned ? "Unpin note" : "Pin note"}
                    </PopoverItem>
                    <PopoverItem
                        onSelect={run(actions.onToggleFavorite)}
                        icon={note.favorite ? <StarOff size={14} strokeWidth={1.8} /> : <Star size={14} strokeWidth={1.8} />}
                    >
                        {note.favorite ? "Remove favorite" : "Add to favorites"}
                    </PopoverItem>
                    {note.tags.length > 0 ? (
                        <>
                            <PopoverDivider />
                            <PopoverLabel>Filter by tag</PopoverLabel>
                            {note.tags.map((tag) => (
                                <PopoverItem
                                    key={tag}
                                    onSelect={run(() => actions.onSelectTag(tag))}
                                    icon={<Check size={12} strokeWidth={2} />}
                                >
                                    {tag}
                                </PopoverItem>
                            ))}
                        </>
                    ) : null}
                    <PopoverDivider />
                    <PopoverItem onSelect={run(actions.onDelete)} icon={<Trash2 size={14} strokeWidth={1.8} />} danger>
                        Delete note
                    </PopoverItem>
                </>
            )}
        </Popover>
    );
}
