export function isWorkspaceEmpty(counts: {
    projects: number;
    notes: number;
    tasks: number;
    activity: number;
}): boolean {
    return counts.projects + counts.notes + counts.tasks + counts.activity === 0;
}
