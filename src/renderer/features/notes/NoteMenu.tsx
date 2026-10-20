import { useEffect, useRef, useState } from "react";
import {
    Archive,
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
import { useI18n } from "@/i18n";

export interface NoteMenuActions {
    onOpen(): void;
    onTogglePin(): void;
    onToggleFavorite(): void;
    onMove(projectId: string | null): void;
    onSelectTag(tag: string): void;
    onDelete(): void;
    // ─── NEW: archive the note without deleting it. ───
    onArchive(): void;
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
    const { t } = useI18n();

    useEffect(() => {
        if (!open) setShowMove(false);
    }, [open]);

    const run = (action: () => void) => () => {
        onClose();
        action();
    };

    const activeProjects = sortProjects(projects.filter((project) => !project.archived));

    return (
        <Popover open={open} anchor={anchor} onClose={onClose} label={t("noteMenu.label")} width={224}>
            {showMove ? (
                <>
                    <PopoverLabel>{t("noteMenu.moveTo")}</PopoverLabel>
                    <PopoverItem
                        onSelect={run(() => actions.onMove(null))}
                        checked={note.projectId === null}
                    >
                        {t("common.unassigned")}
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
                        {t("common.back")}
                    </PopoverItem>
                </>
            ) : (
                <>
                    <PopoverItem onSelect={run(actions.onOpen)} icon={<Pencil size={14} strokeWidth={1.8} />}>
                        {t("noteMenu.edit")}
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
                        <span className="popover-item-label">{t("noteMenu.moveToProject")}</span>
                    </button>
                    <PopoverItem
                        onSelect={run(actions.onTogglePin)}
                        icon={note.pinned ? <PinOff size={14} strokeWidth={1.8} /> : <Pin size={14} strokeWidth={1.8} />}
                    >
                        {note.pinned ? t("noteMenu.unpin") : t("noteMenu.pin")}
                    </PopoverItem>
                    <PopoverItem
                        onSelect={run(actions.onToggleFavorite)}
                        icon={note.favorite ? <StarOff size={14} strokeWidth={1.8} /> : <Star size={14} strokeWidth={1.8} />}
                    >
                        {note.favorite ? t("noteMenu.removeFavorite") : t("noteMenu.addFavorite")}
                    </PopoverItem>
                    {note.tags.length > 0 ? (
                        <>
                            <PopoverDivider />
                            <PopoverLabel>{t("noteMenu.filterByTag")}</PopoverLabel>
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
                    <PopoverItem onSelect={run(actions.onArchive)} icon={<Archive size={14} strokeWidth={1.8} />}>
                        {t("common.archiveNote")}
                    </PopoverItem>
                    <PopoverItem onSelect={run(actions.onDelete)} icon={<Trash2 size={14} strokeWidth={1.8} />} danger>
                        {t("noteMenu.delete")}
                    </PopoverItem>
                </>
            )}
        </Popover>
    );
}
