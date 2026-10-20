import { useMemo, useState } from "react";
import { CheckCircle2, Filter, Plus, Search } from "lucide-react";
import { useStore } from "@/app/store";
import { TASK_FILTERS, filterTasks, type TaskFilter } from "@/app/tasks";
import { EmptyState } from "@/components/EmptyState";
import { sortProjects, sortTasks } from "@/db/schema";
import { isOverdue } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";
import { TaskList } from "./TaskList";

export function TasksPage() {
    const { tasks, projects, ready } = useStore();
    const workflows = useWorkflows();
    const [filter, setFilter] = useState<TaskFilter>("all");
    const [projectFilter, setProjectFilter] = useState("all");
    const [query, setQuery] = useState("");
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [targetIndex, setTargetIndex] = useState<number | null>(null);

    const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
    const activeProjects = useMemo(() => sortProjects(projects.filter((project) => !project.archived)), [projects]);

    const visible = useMemo(() => {
        let rows = filterTasks(tasks, filter);
        if (projectFilter === "none") rows = rows.filter((task) => task.projectId === null);
        else if (projectFilter !== "all") rows = rows.filter((task) => task.projectId === projectFilter);
        if (query.trim()) {
            const term = query.trim().toLowerCase();
            rows = rows.filter((task) => task.title.toLowerCase().includes(term) || task.notes.toLowerCase().includes(term));
        }
        return sortTasks(rows);
    }, [tasks, filter, projectFilter, query]);

    const counts = useMemo(
        () => ({
            total: tasks.length,
            active: tasks.filter((task) => !task.completed).length,
            overdue: tasks.filter((task) => isOverdue(task.dueAt, task.completed)).length,
            favorite: tasks.filter((task) => task.favorite).length
        }),
        [tasks]
    );

    function finishDrag(commit: boolean) {
        const orderedIds = visible.map((task) => task.id);
        const from = orderedIds.indexOf(draggingId ?? "");
        const to = targetIndex;
        setDraggingId(null);
        setTargetIndex(null);
        if (!commit || from === -1 || to === null || from === to) return;
        const next = [...orderedIds];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        void workflows.reorderTasks(next);
    }

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    const reorderEnabled = filter === "all" && projectFilter === "all" && !query.trim();

    return (
        <div className="page tasks-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Tasks</h1>
                    <p className="page-subtitle">
                        {counts.active} active · {counts.overdue} overdue · {counts.favorite} favorite
                    </p>
                </div>
                <div className="page-header-actions">
                    <button
                        type="button"
                        className="button button-primary button-small"
                        onClick={() => workflows.openTaskDialog(null)}
                    >
                        <Plus size={14} strokeWidth={2} aria-hidden="true" />
                        New task
                    </button>
                </div>
            </header>

            <div className="filter-bar">
                <div className="segmented" role="tablist" aria-label="Filter tasks">
                    {TASK_FILTERS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            role="tab"
                            aria-selected={filter === option.id}
                            className={`segment${filter === option.id ? " is-active" : ""}`}
                            onClick={() => setFilter(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <label className="search-field">
                    <Search size={14} strokeWidth={1.9} aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        placeholder="Search tasks"
                        aria-label="Search tasks"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                <label className="inline-field">
                    <span>
                        <Filter size={12} strokeWidth={1.9} aria-hidden="true" /> Project
                    </span>
                    <select
                        className="text-input select-input select-inline"
                        value={projectFilter}
                        onChange={(event) => setProjectFilter(event.target.value)}
                    >
                        <option value="all">All projects</option>
                        <option value="none">Unassigned</option>
                        {activeProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="panel tasks-page-panel">
                {visible.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title={tasks.length === 0 ? "No tasks yet" : "No tasks match these filters"}
                        description={
                            tasks.length === 0
                                ? "Plan your next step with a task and a due date."
                                : "Try another filter or clear the search."
                        }
                        action={
                            tasks.length === 0 ? (
                                <button
                                    type="button"
                                    className="button button-primary button-small"
                                    onClick={() => workflows.openTaskDialog(null)}
                                >
                                    New task
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="button button-ghost button-small"
                                    onClick={() => {
                                        setFilter("all");
                                        setProjectFilter("all");
                                        setQuery("");
                                    }}
                                >
                                    Clear filters
                                </button>
                            )
                        }
                    />
                ) : (
                    <ul className="task-list is-manageable">
                        {visible.map((task, index) => (
                            <li
                                key={task.id}
                                className={`task-manage-row${draggingId === task.id ? " is-dragging" : ""}${targetIndex === index && draggingId ? " is-drop-target" : ""}`}
                                draggable={reorderEnabled}
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", task.id);
                                    setDraggingId(task.id);
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
                            >
                                <TaskList
                                    tasks={[task]}
                                    showProjectName
                                    projectNames={projectNames}
                                    handlers={{
                                        onToggle: workflows.toggleTask,
                                        onToggleFavorite: workflows.toggleTaskFavorite,
                                        onOpen: (row) => workflows.openTaskDialog(row),
                                        onOpenMenu: (row) => workflows.openTaskDialog(row)
                                    }}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <p className="list-hint">
                {reorderEnabled
                    ? "Drag tasks to reorder them. Order is saved locally."
                    : "Clear filters to drag and reorder tasks."}
            </p>
        </div>
    );
}
