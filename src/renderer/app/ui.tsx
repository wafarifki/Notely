import { createContext, useContext } from "react";

export interface UiActions {
    reorderProjects(ids: string[]): Promise<void> | void;
    reorderNotes(ids: string[]): Promise<void> | void;
    reorderTasks(ids: string[]): Promise<void> | void;
}

const UiActionsContext = createContext<UiActions | null>(null);

export const UiActionsProvider = UiActionsContext.Provider;

export function useUiActions(): UiActions {
    const value = useContext(UiActionsContext);
    if (!value) throw new Error("useUiActions must be used inside UiActionsProvider");
    return value;
}
