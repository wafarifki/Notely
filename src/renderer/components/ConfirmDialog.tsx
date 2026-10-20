import type { ReactNode } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({
    open,
    title,
    children,
    confirmLabel,
    cancelLabel = "Cancel",
    tone = "primary",
    busy,
    onCancel,
    onConfirm
}: {
    open: boolean;
    title: string;
    children: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "primary" | "danger";
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <Modal
            open={open}
            size="small"
            title={title}
            onClose={onCancel}
            footer={
                <>
                    <button type="button" className="button button-ghost" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`button ${tone === "danger" ? "button-danger" : "button-primary"}`}
                        data-primary
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <div className="confirm-body">{children}</div>
        </Modal>
    );
}
