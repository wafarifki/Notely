import type { NoteRecord, ProjectRecord, TaskRecord } from "@/db/schema";
import { htmlToPlainText } from "@/lib/noteContent";

export interface SearchResults {
    projects: ProjectRecord[];
    notes: NoteRecord[];
    tasks: TaskRecord[];
    total: number;
}

export function emptySearchResults(): SearchResults {
    return { projects: [], notes: [], tasks: [], total: 0 };
}

export function tokenize(query: string): string[] {
    return query
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
}

function matchesAll(haystack: string, tokens: string[]): boolean {
    const text = haystack.toLowerCase();
    return tokens.every((token) => text.includes(token));
}

export function searchNotes(
    notes: NoteRecord[],
    projects: ProjectRecord[],
    query: string
): NoteRecord[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    return notes
        .filter((note) => {
            const project = note.projectId ? projectNames.get(note.projectId) ?? "" : "unassigned";
            // ─── NEW: bodies are HTML; search the readable text, not the markup. ───
            const haystack = [note.title, htmlToPlainText(note.content), project, ...note.tags].join("\n");
            return matchesAll(haystack, tokens);
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function searchProjects(projects: ProjectRecord[], query: string): ProjectRecord[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    return projects
        .filter((project) => matchesAll(`${project.name}\n${project.description}`, tokens))
        .sort((a, b) => a.order - b.order);
}

export function searchTasks(
    tasks: TaskRecord[],
    projects: ProjectRecord[],
    query: string
): TaskRecord[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    return tasks
        .filter((task) => {
            const project = task.projectId ? projectNames.get(task.projectId) ?? "" : "unassigned";
            return matchesAll(`${task.title}\n${task.notes}\n${project}`, tokens);
        })
        .sort((a, b) => Number(a.completed) - Number(b.completed) || a.order - b.order);
}

export function searchAll(
    query: string,
    notes: NoteRecord[],
    tasks: TaskRecord[],
    projects: ProjectRecord[]
): SearchResults {
    const active = projects.filter((project) => !project.archived);
    const projectResults = searchProjects(active, query);
    const noteResults = searchNotes(notes, projects, query);
    const taskResults = searchTasks(tasks, projects, query);
    return {
        projects: projectResults,
        notes: noteResults,
        tasks: taskResults,
        total: projectResults.length + noteResults.length + taskResults.length
    };
}
