import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, FolderClosed, Plus } from "lucide-react";
import { useStore } from "@/app/store";
import { splitDashboardTasks } from "@/app/tasks";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { sortProjects, type ProjectRecord } from "@/db/schema";
import { useWorkflows } from "@/feature-hooks";
import { useUiActions } from "@/app/ui";
import { ActivityPanel } from "@/features/activity/ActivityPanel";
import { NotesColumn } from "@/features/notes/NotesColumn";
import { ProjectsGrid } from "@/features/projects/ProjectsGrid";
import { ProjectShowcase } from "@/features/projects/ProjectShowcase";
import { TaskList } from "@/features/tasks/TaskList";

const DEMO_BREAKPOINT = 800;

function useDemoLayoutEnabled(): boolean {
    const [enabled, setEnabled] = useState(
        () => typeof window.matchMedia !== "function" || window.matchMedia(`(min-width: ${DEMO_BREAKPOINT}px)`).matches
    );
    useEffect(() => {
        const query = window.matchMedia(`(min-width: ${DEMO_BREAKPOINT}px)`);
        const listener = (event: MediaQueryListEvent) => setEnabled(event.matches);
        query.addEventListener("change", listener);
        return () => query.removeEventListener("change", listener);
    }, []);
    return enabled;
}

export function HomePage() {
    const { projects, notes, tasks, activity, settings, ready } = useStore();
    const { reorderProjects } = useUiActions();
    const workflows = useWorkflows();
    const demoLayout = useDemoLayoutEnabled();
    const firstVisit = settings.demoDragState;

    const activeProjects = useMemo(() => sortProjects(projects.filter((project) => !project.archived)), [projects]);
    const dashboardTasks = useMemo(() => {
        const rows = settings.completedTasksVisible ? tasks : tasks.filter((task) => !task.completed);
        return splitDashboardTasks(rows, 5);
    }, [tasks, settings.completedTasksVisible]);
    const visibleTasks = dashboardTasks.visible;

    if (!ready) {
        return (
            <div className="dashboard-loading" aria-busy="true">
                <div className="skeleton skeleton-title" />
                <div className="skeleton-row">
                    <div className="skeleton skeleton-block" />
                    <div className="skeleton skeleton-block" />
                </div>
            </div>
        );
    }

    const gridHandlers = {
        onOpen: (project: ProjectRecord) => workflows.go({ name: "project", id: project.id }),
        onEdit: (project: ProjectRecord) =>
            workflows.openProjectDialog({ mode: "edit", projectId: project.id }),
        onNewNote: (project: ProjectRecord) => {
            void workflows.createNote({ projectId: project.id, open: true });
        },
        onDelete: (project: ProjectRecord) => workflows.requestDeleteProject(project.id),
        onMove: (project: ProjectRecord, direction: -1 | 1) => {
            const ids = activeProjects.map((row) => row.id);
            const index = ids.indexOf(project.id);
            const target = index + direction;
            if (target < 0 || target >= ids.length) return;
            const next = [...ids];
            [next[index], next[target]] = [next[target], next[index]];
            void reorderProjects(next);
        },
        onReorder: (orderedIds: string[]) => {
            void reorderProjects(orderedIds);
        }
    };

    return (
        <div className="dashboard">
            <h1 className="welcome-title">Welcome back, {settings.displayName.split(" ")[0]}!</h1>

            <div className="dashboard-grid">
                <div className="dashboard-column dashboard-column-left">
                    <section className="dashboard-section projects-section">
                        <SectionHeader
                            icon={FolderClosed}
                            title="My projects"
                            action={
                                <button
                                    type="button"
                                    className="text-action"
                                    onClick={() => workflows.openProjectDialog({ mode: "create" })}
                                >
                                    <Plus size={13} strokeWidth={2} aria-hidden="true" />
                                    New
                                </button>
                            }
                        />
                        {activeProjects.length === 0 ? (
                            <div className="panel">
                                <EmptyState
                                    icon={FolderClosed}
                                    title="No projects yet"
                                    description="Create a project to group notes and tasks."
                                    action={
                                        <button
                                            type="button"
                                            className="button button-primary button-small"
                                            onClick={() => workflows.openProjectDialog({ mode: "create" })}
                                        >
                                            New project
                                        </button>
                                    }
                                />
                            </div>
                        ) : demoLayout && firstVisit && activeProjects.length >= 5 ? (
                            <ProjectShowcase
                                projects={activeProjects}
                                onOpen={(project) => workflows.go({ name: "project", id: project.id })}
                            />
                        ) : (
                            <ProjectsGrid
                                projects={activeProjects}
                                handlers={gridHandlers}
                                dragEnabled={demoLayout}
                                limit={5}
                            />
                        )}
                    </section>

                    <section className="dashboard-section notes-section" id="dashboard-notes">
                        <SectionHeader
                            icon={FileText}
                            title="My notes"
                            action={
                                <button
                                    type="button"
                                    className="text-action"
                                    onClick={() => {
                                        void workflows.createNote({ open: true });
                                    }}
                                >
                                    <Plus size={13} strokeWidth={2} aria-hidden="true" />
                                    New
                                </button>
                            }
                        />
                        {notes.length === 0 ? (
                            <div className="panel">
                                <EmptyState
                                    icon={FileText}
                                    title="Your notes will live here"
                                    description="Write down meeting notes, plans and ideas."
                                    action={
                                        <button
                                            type="button"
                                            className="button button-primary button-small"
                                            onClick={() => {
                                                void workflows.createNote({ open: true });
                                            }}
                                        >
                                            Write a note
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            <NotesColumn
                                notes={notes}
                                projects={projects}
                                limit={4}
                                dragEnabled={demoLayout}
                                showcase={demoLayout && firstVisit && notes.length >= 3}
                                handlers={{
                                    onOpen: (note) => workflows.openNote(note.id),
                                    onDelete: workflows.requestDeleteNote,
                                    onToggleFlag: workflows.toggleNoteFlag,
                                    onMove: workflows.moveNote,
                                    onSelectTag: workflows.filterByTag,
                                    onReorder: (ids) => {
                                        void workflows.reorderNotes(ids);
                                    }
                                }}
                            />
                        )}
                    </section>
                </div>

                <div className="dashboard-column dashboard-column-right">
                    <section className="dashboard-section tasks-section">
                        <SectionHeader
                            icon={CheckCircle2}
                            title="My tasks"
                            action={
                                <button
                                    type="button"
                                    className="text-action"
                                    onClick={() => workflows.openTaskDialog(null)}
                                >
                                    <Plus size={13} strokeWidth={2} aria-hidden="true" />
                                    New
                                </button>
                            }
                        />
                        <div className="panel tasks-panel">
                            {visibleTasks.length === 0 ? (
                                <EmptyState
                                    icon={CheckCircle2}
                                    title="Nothing on your list"
                                    description="Add a task to plan your next step."
                                    compact
                                />
                            ) : (
                                <TaskList
                                    tasks={visibleTasks}
                                    dense
                                    handlers={{
                                        onToggle: workflows.toggleTask,
                                        onToggleFavorite: workflows.toggleTaskFavorite,
                                        onOpen: (task) => workflows.openTaskDialog(task)
                                    }}
                                />
                            )}
                        </div>
                    </section>
                    <ActivityPanel
                        activity={activity}
                        onOpen={(row) => workflows.openActivityTarget(row.entityType, row.entityId)}
                    />
                </div>
            </div>
        </div>
    );
}
