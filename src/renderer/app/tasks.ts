import { isOverdue } from "@/lib/dates";
import { sortTasks, type TaskRecord } from "@/db/schema";

export type TaskFilter = "all" | "active" | "completed" | "overdue" | "favorite";

export const TASK_FILTERS: { id: TaskFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "overdue", label: "Overdue" },
    { id: "favorite", label: "Favorites" }
];

export function filterTasks(tasks: TaskRecord[], filter: TaskFilter, now: Date = new Date()): TaskRecord[] {
    switch (filter) {
        case "active":
            return tasks.filter((task) => !task.completed);
        case "completed":
            return tasks.filter((task) => task.completed);
        case "overdue":
            return tasks.filter((task) => isOverdue(task.dueAt, task.completed, now));
        case "favorite":
            return tasks.filter((task) => task.favorite);
        default:
            return tasks;
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
