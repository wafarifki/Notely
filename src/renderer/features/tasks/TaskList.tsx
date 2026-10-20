import { useState } from "react";
import { Archive, Check, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import type { TaskRecord } from "@/db/schema";
import { formatDueLabel, isOverdue } from "@/lib/dates";
import { useI18n } from "@/i18n";
import { Popover, PopoverDivider, PopoverItem } from "@/components/Popover";

export interface TaskRowHandlers {
    onToggle(task: TaskRecord): void;
    onToggleFavorite(task: TaskRecord): void;
    onOpenMenu?(task: TaskRecord, anchor: HTMLElement): void;
    onOpen?(task: TaskRecord): void;
    // ─── NEW: tasks can be archived or deleted from their row menu. ───
    onArchive?(task: TaskRecord): void;
    onDelete?(task: TaskRecord): void;
}

export function TaskCheckbox({
    checked,
    label,
    onChange
}: {
    checked: boolean;
    label: string;
    onChange: () => void;
}) {
    const { t } = useI18n();
    return (
        <label className={`task-checkbox${checked ? " is-checked" : ""}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                aria-label={
                    checked
                        ? t("task.markNotDone", { title: label })
                        : t("task.markDone", { title: label })
                }
            />
            <span className="task-checkbox-box" aria-hidden="true">
                {checked ? <Check size={12} strokeWidth={3} /> : null}
            </span>
        </label>
    );
}

export function StarButton({
    active,
    label,
    onClick
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    const { t } = useI18n();
    return (
        <button
            type="button"
            className={`task-star${active ? " is-active" : ""}`}
            aria-pressed={active}
            aria-label={
                active
                    ? t("task.removeFavorite", { title: label })
                    : t("task.addFavorite", { title: label })
            }
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            <Star size={16} strokeWidth={1.7} fill={active ? "currentColor" : "none"} />
        </button>
    );
}

export function TaskList({
    tasks,
    handlers,
    now = new Date(),
    dense,
    showMenu,
    showProjectName,
    // ─── NEW: rows rendered straight inside a panel (project page) need their
    // own vertical padding, otherwise the first and last row touch the border. ───
    padded,
    projectNames
}: {
    tasks: TaskRecord[];
    handlers: TaskRowHandlers;
    now?: Date;
    dense?: boolean;
    showMenu?: boolean;
    showProjectName?: boolean;
    padded?: boolean;
    projectNames?: Map<string, string>;
}) {
    const { t } = useI18n();
    // ─── NEW: the inline menu is owned here so every task list gets the same
    // edit / archive / delete actions without extra wiring. ───
    const [menuTask, setMenuTask] = useState<TaskRecord | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const closeMenu = () => {
        setMenuTask(null);
        setMenuAnchor(null);
    };
    return (
        <ul className={`task-list${dense ? " is-dense" : ""}${padded ? " task-list-padded" : ""}`}>
            {tasks.map((task) => {
                const overdue = isOverdue(task.dueAt, task.completed, now);
                const meta = task.completed ? t("common.completed") : formatDueLabel(task.dueAt, now, t);
                const projectName = task.projectId ? projectNames?.get(task.projectId) : undefined;
                // ─── NEW: surface checklist progress next to the due label. ───
                const checklist = task.checklist ?? [];
                const checklistDone = checklist.filter((item) => item.done).length;
                return (
                    <li key={task.id} className={`task-row${task.completed ? " is-completed" : ""}`}>
                        <TaskCheckbox
                            checked={task.completed}
                            label={task.title}
                            onChange={() => handlers.onToggle(task)}
                        />
                        <div className="task-row-text">
                            <button
                                type="button"
                                className="task-row-title"
                                onClick={() => handlers.onOpen?.(task)}
                                title={task.title}
                            >
                                {task.title}
                            </button>
                            <span className={`task-row-meta${overdue ? " is-overdue" : ""}`}>
                                {meta}
                                {checklist.length > 0 ? (
                                    <span className="task-row-checklist">
                                        {" · "}
                                        {t("task.checklistProgress", {
                                            done: checklistDone,
                                            total: checklist.length
                                        })}
                                    </span>
                                ) : null}
                                {overdue ? <span className="sr-only">{t("task.overdueSuffix")}</span> : null}
                                {showProjectName ? (
                                    <span className="task-row-project"> · {projectName ?? t("common.unassigned")}</span>
                                ) : null}
                            </span>
                        </div>
                        <StarButton
                            active={task.favorite}
                            label={task.title}
                            onClick={() => handlers.onToggleFavorite(task)}
                        />
                        {showMenu ? (
                            <button
                                type="button"
                                className="card-menu-button task-row-menu"
                                aria-label={t("task.actionsFor", { title: task.title })}
                                aria-haspopup="menu"
                                onClick={(event) => {
                                    // ─── NEW: prefer the caller's menu, otherwise
                                    // open the built-in one with archive + delete. ───
                                    if (handlers.onOpenMenu) {
                                        handlers.onOpenMenu(task, event.currentTarget);
                                    } else {
                                        setMenuTask(task);
                                        setMenuAnchor(event.currentTarget);
                                    }
                                }}
                            >
                                <MoreHorizontal size={15} strokeWidth={2} />
                            </button>
                        ) : null}
                    </li>
                );
            })}
            {/* ─── NEW: shared task action menu. ─── */}
            {menuTask ? (
                <Popover
                    open
                    anchor={menuAnchor}
                    onClose={closeMenu}
                    label={t("task.actionsFor", { title: menuTask.title })}
                    width={210}
                >
                    <PopoverItem
                        icon={<Pencil size={14} strokeWidth={1.8} />}
                        onSelect={() => {
                            const task = menuTask;
                            closeMenu();
                            handlers.onOpen?.(task);
                        }}
                    >
                        {t("task.editTitle")}
                    </PopoverItem>
                    <PopoverDivider />
                    <PopoverItem
                        icon={<Archive size={14} strokeWidth={1.8} />}
                        onSelect={() => {
                            const task = menuTask;
                            closeMenu();
                            handlers.onArchive?.(task);
                        }}
                    >
                        {t("common.archiveTask")}
                    </PopoverItem>
                    <PopoverItem
                        danger
                        icon={<Trash2 size={14} strokeWidth={1.8} />}
                        onSelect={() => {
                            const task = menuTask;
                            closeMenu();
                            handlers.onDelete?.(task);
                        }}
                    >
                        {t("common.deleteTask")}
                    </PopoverItem>
                </Popover>
            ) : null}
        </ul>
    );
}
