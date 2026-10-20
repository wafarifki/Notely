import { isOverdue } from "@/lib/dates";
import { sortTasks, type TaskRecord } from "@/db/schema";
import type { TranslationKey } from "@/i18n/translations";

export type TaskFilter = "all" | "active" | "completed" | "overdue" | "favorite";

// ─── NEW: filter labels are translation keys so the tab strip follows the language. ───
export const TASK_FILTERS: { id: TaskFilter; labelKey: TranslationKey }[] = [
    { id: "all", labelKey: "tasks.filterAll" },
    { id: "active", labelKey: "tasks.filterActive" },
    { id: "completed", labelKey: "tasks.filterCompleted" },
    { id: "overdue", labelKey: "tasks.filterOverdue" },
    { id: "favorite", labelKey: "tasks.filterFavorites" }
];

export function filterTasks(tasks: TaskRecord[], filter: TaskFilter, now: Date = new Date()): TaskRecord[] {
    // ─── NEW: archived tasks never appear in the active task lists. ───
    const live = tasks.filter((task) => !task.archived);
    switch (filter) {
        case "active":
            return live.filter((task) => !task.completed);
        case "completed":
            return live.filter((task) => task.completed);
        case "overdue":
            return live.filter((task) => isOverdue(task.dueAt, task.completed, now));
        case "favorite":
            return live.filter((task) => task.favorite);
        default:
            return live;
    }
}

export function splitDashboardTasks(
    tasks: TaskRecord[],
    limit = 5
): { visible: TaskRecord[]; hiddenCount: number } {
    const ordered = sortTasks(tasks);
    return {
        visible: ordered.slice(0, limit),
        hiddenCount: Math.max(0, ordered.length - limit)
    };
}
