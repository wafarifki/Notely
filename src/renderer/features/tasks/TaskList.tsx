import { Check, MoreHorizontal, Star } from "lucide-react";
import type { TaskRecord } from "@/db/schema";
import { formatDueLabel, isOverdue } from "@/lib/dates";

export interface TaskRowHandlers {
    onToggle(task: TaskRecord): void;
    onToggleFavorite(task: TaskRecord): void;
    onOpenMenu?(task: TaskRecord, anchor: HTMLElement): void;
    onOpen?(task: TaskRecord): void;
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
    return (
        <label className={`task-checkbox${checked ? " is-checked" : ""}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                aria-label={checked ? `Mark "${label}" as not done` : `Mark "${label}" as done`}
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
    return (
        <button
            type="button"
            className={`task-star${active ? " is-active" : ""}`}
            aria-pressed={active}
            aria-label={active ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
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
    projectNames
}: {
    tasks: TaskRecord[];
    handlers: TaskRowHandlers;
    now?: Date;
    dense?: boolean;
    showMenu?: boolean;
    showProjectName?: boolean;
    projectNames?: Map<string, string>;
}) {
    return (
        <ul className={`task-list${dense ? " is-dense" : ""}`}>
            {tasks.map((task) => {
                const overdue = isOverdue(task.dueAt, task.completed, now);
                const meta = task.completed ? "Completed" : formatDueLabel(task.dueAt, now);
                const projectName = task.projectId ? projectNames?.get(task.projectId) : undefined;
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
                                {overdue ? <span className="sr-only"> (overdue)</span> : null}
                                {showProjectName ? (
                                    <span className="task-row-project"> · {projectName ?? "Unassigned"}</span>
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
                                aria-label={`Task actions for ${task.title}`}
                                aria-haspopup="menu"
                                onClick={(event) => handlers.onOpenMenu?.(task, event.currentTarget)}
                            >
                                <MoreHorizontal size={15} strokeWidth={2} />
                            </button>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
