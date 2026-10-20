import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useI18n } from "@/i18n";

type ToastTone = "success" | "error" | "info";

interface Toast {
    id: number;
    tone: ToastTone;
    message: string;
}

interface ToastApi {
    success(message: string): void;
    error(message: string): void;
    info(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counter = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback(
        (tone: ToastTone, message: string) => {
            counter.current += 1;
            const id = counter.current;
            setToasts((current) => [...current.slice(-3), { id, tone, message }]);
            window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 3600);
        },
        [dismiss]
    );

    const api = useMemo<ToastApi>(
        () => ({
            success: (message) => push("success", message),
            error: (message) => push("error", message),
            info: (message) => push("info", message)
        }),
        [push]
    );
    const { t } = useI18n();

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast toast-${toast.tone}`}>
                        <span className="toast-icon" aria-hidden="true">
                            {toast.tone === "success" ? (
                                <CheckCircle2 size={15} strokeWidth={1.9} />
                            ) : toast.tone === "error" ? (
                                <AlertTriangle size={15} strokeWidth={1.9} />
                            ) : (
                                <Info size={15} strokeWidth={1.9} />
                            )}
                        </span>
                        <span className="toast-message">{toast.message}</span>
                        <button
                            type="button"
                            className="toast-close"
                            onClick={() => dismiss(toast.id)}
                            aria-label={t("toast.dismiss")}
                        >
                            <X size={13} strokeWidth={2} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastApi {
    const value = useContext(ToastContext);
    if (!value) throw new Error("useToast must be used inside ToastProvider");
    return value;
}
