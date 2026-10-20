import { Archive, ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverDivider, PopoverItem } from "@/components/Popover";
import { useI18n } from "@/i18n";

export interface ProjectMenuActions {
    onEdit(): void;
    onNewNote(): void;
    onMove(direction: -1 | 1): void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onDelete(): void;
    // ─── NEW: archive the project from its card menu. ───
    onArchive(): void;
}

export function ProjectMenu({
    open,
    anchor,
    actions,
    onClose,
    label
}: {
    open: boolean;
    anchor: HTMLElement | null;
    actions: ProjectMenuActions;
    onClose: () => void;
    label?: string;
}) {
    const { t } = useI18n();
    const run = (action: () => void) => () => {
        onClose();
        action();
    };

    return (
        <Popover open={open} anchor={anchor} onClose={onClose} label={label ?? t("project.menuLabel")} width={214}>
            <PopoverItem onSelect={run(actions.onEdit)} icon={<Pencil size={14} strokeWidth={1.8} />}>
                {t("project.edit")}
            </PopoverItem>
            <PopoverItem onSelect={run(actions.onNewNote)} icon={<Plus size={14} strokeWidth={1.8} />}>
                {t("project.newNoteHere")}
            </PopoverItem>
            <PopoverDivider />
            <PopoverItem
                onSelect={run(() => actions.onMove(-1))}
                icon={<ArrowUp size={14} strokeWidth={1.8} />}
            >
                {actions.canMoveUp ? t("project.moveUp") : t("project.alreadyFirst")}
            </PopoverItem>
            <PopoverItem
                onSelect={run(() => actions.onMove(1))}
                icon={<ArrowDown size={14} strokeWidth={1.8} />}
            >
                {actions.canMoveDown ? t("project.moveDown") : t("project.alreadyLast")}
            </PopoverItem>
            <PopoverDivider />
            <PopoverItem onSelect={run(actions.onArchive)} icon={<Archive size={14} strokeWidth={1.8} />}>
                {t("project.archive")}
            </PopoverItem>
            <PopoverItem
                onSelect={run(actions.onDelete)}
                icon={<Trash2 size={14} strokeWidth={1.8} />}
                danger
            >
                {t("project.delete")}
            </PopoverItem>
        </Popover>
    );
}
