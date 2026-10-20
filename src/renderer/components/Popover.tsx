import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode
} from "react";
import { createPortal } from "react-dom";

export interface PopoverProps {
    open: boolean;
    anchor: HTMLElement | null;
    onClose: () => void;
    children: ReactNode;
    align?: "start" | "end";
    label: string;
    width?: number;
}

export function Popover({ open, anchor, onClose, children, align = "end", label, width = 210 }: PopoverProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<CSSProperties>({ top: -1000, left: -1000 });

    useLayoutEffect(() => {
        if (!open || !anchor) return;
        const rect = anchor.getBoundingClientRect();
        const panelHeight = panelRef.current?.offsetHeight ?? 0;
        const panelWidth = panelRef.current?.offsetWidth ?? width;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        let top = rect.bottom + 6;
        if (top + panelHeight > viewportHeight - 12) {
            top = Math.max(12, rect.top - panelHeight - 6);
        }
        let left = align === "end" ? rect.right - panelWidth : rect.left;
        left = Math.min(Math.max(12, left), viewportWidth - panelWidth - 12);
        setPosition({ top, left, minWidth: width });
    }, [open, anchor, align, width]);

    useLayoutEffect(() => {
        if (!open || !anchor) return;
        const timer = window.setTimeout(() => {
            panelRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [open, anchor]);

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (anchor?.contains(target)) return;
            onClose();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
                anchor?.focus();
            }
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [open, anchor, onClose]);

    if (!open) return null;

    return createPortal(
        <div ref={panelRef} className="popover" role="menu" aria-label={label} style={position}>
            {children}
        </div>,
        document.body
    );
}

export function PopoverItem({
    onSelect,
    icon,
    children,
    danger,
    checked
}: {
    onSelect: () => void;
    icon?: ReactNode;
    children: ReactNode;
    danger?: boolean;
    checked?: boolean;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            className={`popover-item${danger ? " is-danger" : ""}`}
            onClick={onSelect}
            aria-checked={checked}
        >
            {icon ? <span className="popover-item-icon">{icon}</span> : null}
            <span className="popover-item-label">{children}</span>
            {checked ? <span className="popover-item-check" aria-hidden="true">✓</span> : null}
        </button>
    );
}

export function PopoverDivider() {
    return <div className="popover-divider" role="separator" />;
}

export function PopoverLabel({ children }: { children: ReactNode }) {
    return <div className="popover-label">{children}</div>;
}
