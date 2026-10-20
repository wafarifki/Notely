import { createContext, useContext, type ReactNode } from "react";
import type { Route } from "./app/router";
import type { NoteRecord, TaskRecord } from "./db/schema";

export interface ProjectDialogRequest {
    mode: "create" | "edit";
    projectId?: string;
    onCreated?: (id: string) => void;
}

export interface AppWorkflows {
    go(route: Route): void;
    openSearch(): void;
    openProjectDialog(request: ProjectDialogRequest): void;
    requestDeleteProject(projectId: string): void;
    toggleProjectArchive(projectId: string): void;
    openNote(noteId: string, options?: { focusTitle?: boolean }): void;
    createNote(options?: { projectId?: string | null; open?: boolean }): Promise<NoteRecord | null>;
    openNoteDialog(note: NoteRecord): void;
    requestDeleteNote(note: NoteRecord): void;
    // ─── NEW: notes and tasks can be archived instead of deleted. ───
    archiveNote(note: NoteRecord, archived: boolean): void;
    archiveTask(task: TaskRecord, archived: boolean): void;
    toggleNoteFlag(note: NoteRecord, flag: "pinned" | "favorite"): void;
    moveNote(note: NoteRecord, projectId: string | null): void;
    openTaskDialog(task?: TaskRecord | null, defaultProjectId?: string | null): void;
    requestDeleteTask(task: TaskRecord): void;
    toggleTask(task: TaskRecord): void;
    toggleTaskFavorite(task: TaskRecord): void;
    reorderTasks(orderedIds: string[]): void;
    filterByTag(tag: string): void;
    reorderNotes(ids: string[]): Promise<void> | void;
    reorderProjects(ids: string[]): Promise<void> | void;
    openActivityTarget(entityType: "project" | "note" | "task", entityId: string | null): void;
}

const WorkflowsContext = createContext<AppWorkflows | null>(null);

export function WorkflowsProvider({ value, children }: { value: AppWorkflows; children: ReactNode }) {
    return <WorkflowsContext.Provider value={value}>{children}</WorkflowsContext.Provider>;
}

export function useWorkflows(): AppWorkflows {
    const value = useContext(WorkflowsContext);
    if (!value) throw new Error("useWorkflows must be used inside WorkflowsProvider");
    return value;
}
