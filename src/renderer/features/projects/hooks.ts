import { useCallback, useState } from "react";
import { useStore, describeError } from "@/app/store";
import type { ProjectDeleteStrategy, ProjectInput } from "@/db/projectRepository";
import type { ProjectRecord } from "@/db/schema";
import { useToast } from "@/components/Toasts";

export function useProjectActions() {
    const { service, notes, tasks, refresh } = useStore();
    const toast = useToast();
    const [pending, setPending] = useState(false);

    const saveProject = useCallback(
        async (values: ProjectInput, projectId?: string): Promise<ProjectRecord> => {
            setPending(true);
            try {
                const saved = projectId
                    ? await service.updateProject(projectId, values)
                    : await service.createProject(values);
                toast.success(projectId ? "Project updated." : "Project created.");
                return saved;
            } finally {
                setPending(false);
            }
        },
        [service, toast]
    );

    const deleteProject = useCallback(
        async (projectId: string, strategy: ProjectDeleteStrategy) => {
            setPending(true);
            try {
                await service.deleteProject(projectId, strategy);
                toast.success(strategy === "unassign" ? "Project deleted. Items moved to Unassigned." : "Project and related items deleted.");
            } catch (error) {
                toast.error(describeError(error));
                throw error;
            } finally {
                setPending(false);
            }
        },
        [service, toast]
    );

    const archiveProject = useCallback(
        async (projectId: string, archived: boolean) => {
            try {
                await service.archiveProject(projectId, archived);
                toast.success(archived ? "Project archived." : "Project restored.");
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [service, toast]
    );

    const reorderProjects = useCallback(
        async (orderedIds: string[]) => {
            try {
                await service.reorderProjects(orderedIds);
            } catch (error) {
                toast.error(describeError(error));
                refresh();
            }
        },
        [service, toast, refresh]
    );

    const projectItemCounts = useCallback(
        (projectId: string) => ({
            notes: notes.filter((note) => note.projectId === projectId).length,
            tasks: tasks.filter((task) => task.projectId === projectId).length
        }),
        [notes, tasks]
    );

    return { pending, saveProject, deleteProject, archiveProject, reorderProjects, projectItemCounts };
}
