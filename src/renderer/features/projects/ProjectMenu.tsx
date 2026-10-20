import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverDivider, PopoverItem } from "@/components/Popover";

export interface ProjectMenuActions {
    onEdit(): void;
    onNewNote(): void;
    onMove(direction: -1 | 1): void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onDelete(): void;
}

export function ProjectMenu({
    open,
    anchor,
    actions,
    onClose,
    label = "Project actions"
}: {
    open: boolean;
    anchor: HTMLElement | null;
    actions: ProjectMenuActions;
    onClose: () => void;
    label?: string;
}) {
    const run = (action: () => void) => () => {
        onClose();
        action();
    };

    return (
        <Popover open={open} anchor={anchor} onClose={onClose} label={label} width={214}>
            <PopoverItem onSelect={run(actions.onEdit)} icon={<Pencil size={14} strokeWidth={1.8} />}>
                Edit project
            </PopoverItem>
            <PopoverItem onSelect={run(actions.onNewNote)} icon={<Plus size={14} strokeWidth={1.8} />}>
                New note here
            </PopoverItem>
            <PopoverDivider />
            <PopoverItem
                onSelect={run(() => actions.onMove(-1))}
                icon={<ArrowUp size={14} strokeWidth={1.8} />}
            >
                {actions.canMoveUp ? "Move up" : "Already first"}
            </PopoverItem>
            <PopoverItem
                onSelect={run(() => actions.onMove(1))}
                icon={<ArrowDown size={14} strokeWidth={1.8} />}
            >
                {actions.canMoveDown ? "Move down" : "Already last"}
            </PopoverItem>
            <PopoverDivider />
            <PopoverItem
                onSelect={run(actions.onDelete)}
                icon={<Trash2 size={14} strokeWidth={1.8} />}
                danger
            >
                Delete project
            </PopoverItem>
        </Popover>
    );
}
