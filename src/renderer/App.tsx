import { useCallback, useEffect, useMemo, useState } from "react";
import { DataProvider, describeError, useStore } from "@/app/store";
import { useHashRoute, type Route } from "@/app/router";
import { AppShell } from "@/app/AppShell";
import { UiActionsProvider, type UiActions } from "@/app/ui";
import { WorkflowsProvider, type AppWorkflows } from "@/feature-hooks";
import { ToastProvider, useToast } from "@/components/Toasts";
import { ProjectDialog } from "@/components/ProjectDialog";
import { TaskDialog } from "@/features/tasks/TaskDialog";
import { DeleteProjectDialog } from "@/features/projects/DeleteProjectDialog";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { SearchOverlay } from "@/features/search/SearchOverlay";
import { HomePage } from "@/features/home/HomePage";
import { NotesPage } from "@/features/notes/NotesPage";
import { NoteEditorPage } from "@/features/notes/NoteEditorPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { ProjectPage } from "@/features/projects/ProjectPage";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PrivacyPage, SupportPage, WhatsNewPage } from "@/features/info/InfoPages";
import { PRIMARY_COLORS, type NoteRecord, type TaskRecord } from "@/db/schema";

interface ProjectDialogState {
    mode: "create" | "edit";
    projectId?: string;
    onCreated?: (id: string) => void;
}

function Workspace() {
    const store = useStore();
    const toast = useToast();
    const { route, navigate } = useHashRoute();
    const [searchOpen, setSearchOpen] = useState(false);
    const [projectDialog, setProjectDialog] = useState<ProjectDialogState | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
    const [noteToDelete, setNoteToDelete] = useState<NoteRecord | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<TaskRecord | null>(null);
    const [taskDialog, setTaskDialog] = useState<{ taskId: string | null; defaultProjectId: string | null } | null>(null);
    const [noteFocusTitle, setNoteFocusTitle] = useState(false);

    const go = useCallback(
        (next: Route) => {
            if (next.name !== "note") setNoteFocusTitle(false);
            navigate(next);
        },
        [navigate]
    );

    const toggleSidebar = useCallback(() => {
        void store.service.settings.update({ sidebarCollapsed: !store.settings.sidebarCollapsed });
    }, [store.settings.sidebarCollapsed, store.service]);

    const toggleProjects = useCallback(() => {
        void store.service.settings.update({ projectsExpanded: !store.settings.projectsExpanded });
    }, [store.settings.projectsExpanded, store.service]);

    const openTaskDialog = useCallback((task?: TaskRecord | null, defaultProjectId?: string | null) => {
        setTaskDialog({ taskId: task?.id ?? null, defaultProjectId: defaultProjectId ?? null });
    }, []);

    const openNote = useCallback(
        (noteId: string, options?: { focusTitle?: boolean }) => {
            setNoteFocusTitle(Boolean(options?.focusTitle));
            go({ name: "note", id: noteId });
        },
        [go]
    );

    const createNote = useCallback(
        async (options?: { projectId?: string | null; open?: boolean }) => {
            try {
                const note = await store.service.createNote({
                    title: "",
                    content: "",
                    projectId: options?.projectId ?? null,
                    tags: []
                });
                toast.success("Note created.");
                if (options?.open !== false) {
                    openNote(note.id, { focusTitle: true });
                }
                return note;
            } catch (error) {
                toast.error(describeError(error));
                return null;
            }
        },
        [store.service, toast, openNote]
    );

    const requestDeleteProject = useCallback((projectId: string) => setDeletingProjectId(projectId), []);

    const deleteProject = useCallback(
        async (strategy: "unassign" | "delete") => {
            if (!deletingProjectId) return;
            await store.service.deleteProject(deletingProjectId, strategy);
            toast.success(strategy === "unassign" ? "Project deleted. Items moved to Unassigned." : "Project deleted.");
            setDeletingProjectId(null);
            if (route.name === "project" && route.id === deletingProjectId) {
                go({ name: "home" });
            }
        },
        [deletingProjectId, store.service, toast, route, go]
    );

    const confirmDeleteNote = useCallback(async () => {
        if (!noteToDelete) return;
        try {
            await store.service.deleteNote(noteToDelete.id);
            toast.success("Note deleted.");
            if (route.name === "note" && route.id === noteToDelete.id) {
                go({ name: "notes" });
            }
        } catch (error) {
            toast.error(describeError(error));
        }
        setNoteToDelete(null);
    }, [noteToDelete, store.service, toast, route, go]);

    const confirmDeleteTask = useCallback(async () => {
        if (!taskToDelete) return;
        try {
            await store.service.deleteTask(taskToDelete.id);
            toast.success("Task deleted.");
            if (taskDialog?.taskId === taskToDelete.id) {
                setTaskDialog(null);
            }
        } catch (error) {
            toast.error(describeError(error));
        }
        setTaskToDelete(null);
    }, [taskToDelete, store.service, toast, taskDialog]);

    const toggleTask = useCallback(
        async (task: TaskRecord) => {
            try {
                await store.service.toggleTaskComplete(task.id);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const toggleTaskFavorite = useCallback(
        async (task: TaskRecord) => {
            try {
                await store.service.toggleTaskFavorite(task.id);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const toggleNoteFlag = useCallback(
        async (note: NoteRecord, flag: "pinned" | "favorite") => {
            try {
                await store.service.toggleNoteFlag(note.id, flag);
                const turningOn = !note[flag];
                toast.success(flag === "pinned" ? (turningOn ? "Note pinned." : "Note unpinned.") : turningOn ? "Added to favorites." : "Removed from favorites.");
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const moveNote = useCallback(
        async (note: NoteRecord, projectId: string | null) => {
            try {
                await store.service.moveNote(note.id, projectId);
                toast.success(projectId ? "Note moved." : "Note moved to Unassigned.");
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const openActivityTarget = useCallback(
        (entityType: "project" | "note" | "task", entityId: string | null) => {
            if (!entityId) return;
            if (entityType === "project") {
                if (store.projects.some((project) => project.id === entityId)) go({ name: "project", id: entityId });
                else toast.info("That project no longer exists.");
            } else if (entityType === "note") {
                if (store.notes.some((note) => note.id === entityId)) openNote(entityId);
                else toast.info("That note no longer exists.");
            } else {
                const task = store.tasks.find((row) => row.id === entityId);
                if (task) openTaskDialog(task);
                else toast.info("That task no longer exists.");
            }
        },
        [store.projects, store.notes, store.tasks, go, openNote, openTaskDialog, toast]
    );

    const reorderProjects = useCallback(
        async (ids: string[]) => {
            try {
                await store.service.reorderProjects(ids);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const reorderNotes = useCallback(
        async (ids: string[]) => {
            try {
                await store.service.reorderNotes(ids);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const reorderTasks = useCallback(
        async (ids: string[]) => {
            try {
                await store.service.reorderTasks(ids);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const workflows = useMemo<AppWorkflows>(
        () => ({
            go,
            openSearch: () => setSearchOpen(true),
            openProjectDialog: (request) => setProjectDialog(request),
            requestDeleteProject,
            toggleProjectArchive: (projectId) => {
                const project = store.projects.find((row) => row.id === projectId);
                if (!project) return;
                store.service
                    .archiveProject(projectId, !project.archived)
                    .then(() => toast.success(project.archived ? "Project restored." : "Project archived."))
                    .catch((error: unknown) => toast.error(describeError(error)));
            },
            openNote,
            createNote,
            openNoteDialog: (note) => openNote(note.id),
            requestDeleteNote: (note) => setNoteToDelete(note),
            toggleNoteFlag,
            moveNote,
            openTaskDialog,
            requestDeleteTask: (task) => setTaskToDelete(task),
            toggleTask,
            toggleTaskFavorite,
            reorderTasks,
            filterByTag: (tag) => go({ name: "notes", tag }),
            reorderNotes,
            reorderProjects,
            openActivityTarget
        }),
        [
            go,
            requestDeleteProject,
            store.projects,
            store.service,
            toast,
            openNote,
            createNote,
            toggleNoteFlag,
            moveNote,
            openTaskDialog,
            toggleTask,
            toggleTaskFavorite,
            reorderTasks,
            reorderNotes,
            reorderProjects,
            openActivityTarget
        ]
    );

    const uiActions = useMemo<UiActions>(
        () => ({ reorderProjects, reorderNotes, reorderTasks }),
        [reorderProjects, reorderNotes, reorderTasks]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isMeta = event.ctrlKey || event.metaKey;
            if (isMeta && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setSearchOpen(true);
            }
            if (isMeta && event.key.toLowerCase() === "n" && !event.shiftKey) {
                const target = event.target as HTMLElement;
                if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
                event.preventDefault();
                void createNote({ open: true });
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [createNote]);

    const deletingProject = store.projects.find((project) => project.id === deletingProjectId) ?? null;
    const relationCounts = useMemo(
        () => ({
            notes: store.notes.filter((note) => note.projectId === deletingProjectId).length,
            tasks: store.tasks.filter((task) => task.projectId === deletingProjectId).length
        }),
        [store.notes, store.tasks, deletingProjectId]
    );

    const editingProject = projectDialog?.projectId
        ? store.projects.find((project) => project.id === projectDialog.projectId) ?? null
        : null;
    const activeTask = taskDialog?.taskId ? store.tasks.find((task) => task.id === taskDialog.taskId) ?? null : null;
    const suggestedColor = useMemo(() => {
        const used = new Set(store.projects.filter((project) => !project.archived).map((project) => project.color));
        return PRIMARY_COLORS.find((color) => !used.has(color)) ?? "purple";
    }, [store.projects]);

    return (
        <WorkflowsProvider value={workflows}>
            <UiActionsProvider value={uiActions}>
                {store.error ? (
                    <div className="fatal-banner" role="alert">
                        Local storage problem: {store.error}
                        <button type="button" className="button button-small button-ghost" onClick={() => window.location.reload()}>
                            Reload
                        </button>
                    </div>
                ) : null}
                <AppShell
                    route={route}
                    navigate={go}
                    settings={store.settings}
                    onOpenSearch={() => setSearchOpen(true)}
                    onNewProject={() => setProjectDialog({ mode: "create" })}
                    onToggleSidebar={toggleSidebar}
                    onToggleProjects={toggleProjects}
                >
                    <main className="app-scroll scroll-area" key={route.name === "note" ? route.id : route.name}>
                        {route.name === "home" ? <HomePage /> : null}
                        {route.name === "notes" ? <NotesPage key={route.tag ?? "all"} initialTag={route.tag} /> : null}
                        {route.name === "note" ? (
                            <NoteEditorPage key={route.id} noteId={route.id} focusTitle={noteFocusTitle} />
                        ) : null}
                        {route.name === "tasks" ? <TasksPage /> : null}
                        {route.name === "project" ? <ProjectPage key={route.id} projectId={route.id} /> : null}
                        {route.name === "activity" ? <ActivityPage /> : null}
                        {route.name === "settings" ? <SettingsPage /> : null}
                        {route.name === "support" ? <SupportPage /> : null}
                        {route.name === "whats-new" ? <WhatsNewPage /> : null}
                        {route.name === "privacy" ? <PrivacyPage /> : null}
                    </main>
                </AppShell>

                <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

                <ProjectDialog
                    open={Boolean(projectDialog)}
                    project={editingProject}
                    suggestedColor={suggestedColor}
                    onClose={() => setProjectDialog(null)}
                    onSubmit={async (values) => {
                        if (projectDialog?.mode === "edit" && editingProject) {
                            await store.service.updateProject(editingProject.id, values);
                            toast.success("Project updated.");
                        } else {
                            const created = await store.service.createProject(values);
                            toast.success("Project created.");
                            projectDialog?.onCreated?.(created.id);
                        }
                        setProjectDialog(null);
                    }}
                />

                <DeleteProjectDialog
                    project={deletingProject}
                    relationCounts={relationCounts}
                    onClose={() => setDeletingProjectId(null)}
                    onConfirm={deleteProject}
                />

                <TaskDialog
                    open={Boolean(taskDialog)}
                    task={activeTask}
                    projects={store.projects}
                    defaultProjectId={taskDialog?.defaultProjectId}
                    onClose={() => setTaskDialog(null)}
                    onSubmit={async (values) => {
                        if (taskDialog?.taskId) {
                            await store.service.updateTask(taskDialog.taskId, values);
                            toast.success("Task updated.");
                        } else {
                            await store.service.createTask(values);
                            toast.success("Task created.");
                        }
                        setTaskDialog(null);
                    }}
                    onDelete={
                        activeTask
                            ? () => {
                                  setTaskToDelete(activeTask);
                              }
                            : undefined
                    }
                />

                <DeleteConfirm
                    open={Boolean(noteToDelete)}
                    subject="note"
                    detail={noteToDelete ? `“${noteToDelete.title || "Untitled note"}” will be removed.` : undefined}
                    onCancel={() => setNoteToDelete(null)}
                    onConfirm={() => void confirmDeleteNote()}
                />

                <DeleteConfirm
                    open={Boolean(taskToDelete)}
                    subject="task"
                    detail={taskToDelete ? `“${taskToDelete.title}” will be removed.` : undefined}
                    onCancel={() => setTaskToDelete(null)}
                    onConfirm={() => void confirmDeleteTask()}
                />

            </UiActionsProvider>
        </WorkflowsProvider>
    );
}

export function App() {
    return (
        <ToastProvider>
            <DataProvider>
                <Workspace />
            </DataProvider>
        </ToastProvider>
    );
}
