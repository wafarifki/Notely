import type { SettingsRecord } from "./schema";

export const DEFAULT_PROFILE: SettingsRecord = {
    id: "app",
    displayName: "Notely",
    email: "user@user.com",
    avatarId: "nick-woods",
    avatarImage: null,
    avatarImageUpdatedAt: null,
    projectsExpanded: true,
    sidebarCollapsed: false,
    completedTasksVisible: true,
    showWeekends: true,
    theme: "auto",
    accent: "purple",
    customAccent: null,
    customCanvas: null,
    language: "en",
    tourCompleted: false,
    hasSeenTour: false,
    animatedBackground: true
};

export function createDefaultProfile(): SettingsRecord {
    return { ...DEFAULT_PROFILE };
}
