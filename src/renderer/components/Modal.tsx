import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    size?: "small" | "medium" | "large";
    labelledBy?: string;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
    open,
    title,
    description,
    onClose,
    children,
    footer,
    size = "medium",
    labelledBy
}: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;
        restoreFocusRef.current = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        const firstField = dialog?.querySelector<HTMLElement>(
            "input, textarea, select, [data-autofocus], button[data-primary]"
        );
        (firstField ?? dialog)?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialog) return;
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (element) => element.offsetParent !== null
            );
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown, true);
        document.body.classList.add("has-modal");
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            document.body.classList.remove("has-modal");
            restoreFocusRef.current?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <div
                ref={dialogRef}
                className={`modal modal-${size}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy ?? "modal-title"}
                aria-describedby={description ? "modal-description" : undefined}
                tabIndex={-1}
            >
                <div className="modal-header">
                    <div>
                        <h2 id={labelledBy ?? "modal-title"} className="modal-title">
                            {title}
                        </h2>
                        {description ? (
                            <p id="modal-description" className="modal-description">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
                        <X size={16} strokeWidth={1.8} />
                    </button>
                </div>
                <div className="modal-body scroll-area">{children}</div>
                {footer ? <div className="modal-footer">{footer}</div> : null}
            </div>
        </div>,
        document.body
    );
}
