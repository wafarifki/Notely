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
    seeded: boolean;
    projects: ProjectRecord[];
    notes: NoteRecord[];
    tasks: TaskRecord[];
    activity: ActivityRecord[];
    settings: SettingsRecord;
}

const FALLBACK_SETTINGS: SettingsRecord = {
    id: "app",
    displayName: "Nick Woods",
    email: "nick.woods@gmail.com",
    avatarId: "nick-woods",
    projectsExpanded: true,
    sidebarCollapsed: false,
    demoDragState: true,
    completedTasksVisible: true,
    showWeekends: true
};

interface StoreValue extends DataState {
    service: NotesService;
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
    const [status, setStatus] = useState<{ ready: boolean; error: string | null; seeded: boolean }>({
        ready: false,
        error: null,
        seeded: false
    });
    const [, forceRefresh] = useReducer((value: number) => value + 1, 0);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        service
            .initialize()
            .then((seeded) => {
                if (!mounted.current) return;
                setStatus({ ready: true, error: null, seeded });
            })
            .catch((error: unknown) => {
                if (!mounted.current) return;
                setStatus({ ready: false, error: describeError(error), seeded: false });
            });
        return () => {
            mounted.current = false;
        };
    }, [service]);

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

    const refresh = useCallback(() => forceRefresh(), []);
    const setDataError = useCallback((message: string | null) => {
        setStatus((current) => ({ ...current, error: message }));
    }, []);

    const value = useMemo<StoreValue>(
        () => ({
            ready: status.ready,
            error: status.error,
            seeded: status.seeded,
            projects: projects ?? [],
            notes: notes ?? [],
            tasks: tasks ?? [],
            activity: activity ?? [],
            settings: settings ?? FALLBACK_SETTINGS,
            service,
            refresh,
            setDataError
        }),
        [status, projects, notes, tasks, activity, settings, service, refresh, setDataError]
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
