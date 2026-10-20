import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
    type ReactNode
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDatabase } from "@/db/database";
import { createNotesService, type NotesService } from "@/data/service";
import { createDefaultProfile } from "@/db/seed";
import { applyAppearance, resolveAppearance } from "@/theme/applyTheme";
import type {
    ActivityRecord,
    NoteRecord,
    ProjectRecord,
    SettingsRecord,
    TaskRecord
} from "@/db/schema";

interface DataState {
    ready: boolean;
    error: string | null;
    isFirstRun: boolean;
    projects: ProjectRecord[];
    notes: NoteRecord[];
    tasks: TaskRecord[];
    activity: ActivityRecord[];
    settings: SettingsRecord;
}

const FALLBACK_SETTINGS: SettingsRecord = createDefaultProfile();

interface StoreValue extends DataState {
    service: NotesService;
    // ─── NEW: true only once the stored settings row has actually been read.
    // Before that `settings` is a default profile, so first-run logic must wait.
    settingsLoaded: boolean;
    refresh: () => void;
    setDataError: (message: string | null) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function describeError(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return "Something went wrong while talking to local storage.";
}

export function DataProvider({ children }: { children: ReactNode }) {
    const database = useMemo(() => getDatabase(), []);
    const service = useMemo(() => createNotesService(database), [database]);
    const [status, setStatus] = useState<{ ready: boolean; error: string | null }>({
        ready: false,
        error: null
    });
    const [isFirstRun, setIsFirstRun] = useState(false);
    const settingsRef = useRef<SettingsRecord>(FALLBACK_SETTINGS);
    const [, forceRefresh] = useReducer((value: number) => value + 1, 0);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        service
            .initialize()
            .then(async () => {
                if (!mounted.current) return;
                const projects = await database.projects.count();
                const notes = await database.notes.count();
                const tasks = await database.tasks.count();
                if (!mounted.current) return;
                setIsFirstRun(projects + notes + tasks === 0);
                setStatus({ ready: true, error: null });
            })
            .catch((error: unknown) => {
                if (!mounted.current) return;
                setStatus({ ready: false, error: describeError(error) });
            });
        return () => {
            mounted.current = false;
        };
    }, [service, database]);

    const ready = status.ready;

    const projects = useLiveQuery(
        () => (ready ? database.projects.orderBy("order").toArray() : []),
        [database, ready],
        undefined
    );
    const notes = useLiveQuery(() => (ready ? database.notes.toArray() : []), [database, ready], undefined);
    const tasks = useLiveQuery(() => (ready ? database.tasks.toArray() : []), [database, ready], undefined);
    const activity = useLiveQuery(
        () => (ready ? database.activity.orderBy("createdAt").reverse().limit(60).toArray() : []),
        [database, ready],
        undefined
    );
    const settings = useLiveQuery(
        () => (ready ? database.settings.get("app") : undefined),
        [database, ready],
        undefined
    );

    useEffect(() => {
        if (!ready) return;
        applyAppearance(resolveAppearance(settings ?? FALLBACK_SETTINGS));
    }, [ready, settings]);

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const listener = () => {
            const current = settingsRef.current;
            if (current.theme === "auto") {
                applyAppearance(resolveAppearance(current));
            }
        };
        query.addEventListener("change", listener);
        return () => query.removeEventListener("change", listener);
    }, []);

    const refresh = useCallback(() => forceRefresh(), []);
    const setDataError = useCallback((message: string | null) => {
        setStatus((current) => ({ ...current, error: message }));
    }, []);

    settingsRef.current = settings ?? FALLBACK_SETTINGS;

    const value = useMemo<StoreValue>(
        () => ({
            ready: status.ready,
            error: status.error,
            isFirstRun,
            projects: projects ?? [],
            notes: notes ?? [],
            tasks: tasks ?? [],
            activity: activity ?? [],
            settings: settings ?? FALLBACK_SETTINGS,
            settingsLoaded: Boolean(ready && settings),
            service,
            refresh,
            setDataError
        }),
        [status, isFirstRun, projects, notes, tasks, activity, settings, service, ready, refresh, setDataError]
    );

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
    const value = useContext(StoreContext);
    if (!value) {
        throw new Error("useStore must be used inside DataProvider");
    }
    return value;
}
