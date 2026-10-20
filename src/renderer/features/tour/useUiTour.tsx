import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Route } from "@/app/router";
import type { TranslationKey } from "@/i18n/translations";

export interface TourApi {
    startTour: () => void;
    stopTour: () => void;
    active: boolean;
    step: number;
    goToStep: (index: number) => void;
    isLoading: boolean;
    setComplete: () => void;
}

export interface TourStep {
    target: string;
    fallback?: string;
    route: Route;
    // ─── NEW: copy is stored as translation keys so the tour follows the language. ───
    titleKey: TranslationKey;
    bodyKey: TranslationKey;
    placement: "right" | "left" | "bottom" | "top";
}

export const TOUR_STEPS: TourStep[] = [
    {
        target: '[data-tour="profile"]',
        route: { name: "home" },
        titleKey: "tour.profileTitle",
        bodyKey: "tour.profileBody",
        placement: "right"
    },
    {
        target: '[data-tour="new-project"]',
        route: { name: "home" },
        titleKey: "tour.projectTitle",
        bodyKey: "tour.projectBody",
        placement: "right"
    },
    {
        target: '[data-tour="search"]',
        route: { name: "home" },
        titleKey: "tour.searchTitle",
        bodyKey: "tour.searchBody",
        placement: "right"
    },
    {
        target: '[data-tour="dashboard-grid"]',
        route: { name: "home" },
        titleKey: "tour.dashboardTitle",
        bodyKey: "tour.dashboardBody",
        placement: "bottom"
    },
    {
        target: '[data-tour="new-note"]',
        fallback: '[data-tour="nav-notes"]',
        route: { name: "notes" },
        titleKey: "tour.notesTitle",
        bodyKey: "tour.notesBody",
        placement: "bottom"
    },
    {
        target: '[data-tour="task-filters"]',
        fallback: '[data-tour="nav-tasks"]',
        route: { name: "tasks" },
        titleKey: "tour.tasksTitle",
        bodyKey: "tour.tasksBody",
        placement: "bottom"
    },
    {
        target: '[data-tour="settings-appearance"]',
        route: { name: "settings" },
        titleKey: "tour.appearanceTitle",
        bodyKey: "tour.appearanceBody",
        placement: "bottom"
    },
    {
        target: '[data-tour="about-credits"]',
        route: { name: "settings" },
        titleKey: "tour.creditsTitle",
        bodyKey: "tour.creditsBody",
        placement: "top"
    }
];

const TourContext = createContext<TourApi | null>(null);

export function TourProvider({
    children,
    navigate,
    onTourFinished
}: {
    children: ReactNode;
    navigate: (route: Route) => void;
    onTourFinished?: () => void;
}) {
    const [active, setActive] = useState(false);
    const [step, setStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const startTour = useCallback(() => {
        setStep(0);
        setActive(true);
        setIsLoading(true);
        navigate(TOUR_STEPS[0].route);
    }, [navigate]);

    const stopTour = useCallback(() => {
        setActive(false);
        setIsLoading(false);
        onTourFinished?.();
    }, [onTourFinished]);

    const goToStep = useCallback(
        (index: number) => {
            const next = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
            setStep(next);
            setIsLoading(true);
            navigate(TOUR_STEPS[next].route);
        },
        [navigate]
    );

    const value = useMemo<TourApi>(
        () => ({
            startTour,
            stopTour,
            active,
            step,
            goToStep,
            isLoading,
            setComplete: () => setIsLoading(false)
        }),
        [startTour, stopTour, active, step, goToStep, isLoading]
    );

    return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useUiTour(): TourApi {
    const value = useContext(TourContext);
    if (!value) throw new Error("useUiTour must be used inside TourProvider");
    return value;
}
