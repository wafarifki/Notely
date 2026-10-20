import { ConfirmDialog } from "./ConfirmDialog";

export function DeleteConfirm({
    open,
    subject,
    detail,
    onCancel,
    onConfirm
}: {
    open: boolean;
    subject: string;
    detail?: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <ConfirmDialog
            open={open}
            title={`Delete ${subject}?`}
            confirmLabel="Delete"
            tone="danger"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            <p>This will permanently remove the {subject} from your local workspace. This cannot be undone.</p>
            {detail ? <p className="confirm-muted">{detail}</p> : null}
        </ConfirmDialog>
    );
}
