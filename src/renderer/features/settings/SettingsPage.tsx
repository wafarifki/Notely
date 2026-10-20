import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, RotateCcw, ShieldAlert, Upload } from "lucide-react";
import { describeError, useStore } from "@/app/store";
import { Avatar, AVATAR_IDS } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toasts";
import type { BackupFile, ImportMode, ImportPreview } from "@/db/backup";
import type { SettingsRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";

type PendingAction = "demo" | "clear" | null;

const AVATARS_LABEL: Record<string, string> = {
    "nick-woods": "Nick Woods portrait",
    "maya-hayes": "Maya Hayes portrait",
    "cassie-melendez": "Cassie Melendez portrait",
    "ronny-schultz": "Ronny Schultz portrait",
    "amanda-finnegan": "Amanda Finnegan portrait",
    "rob-houghton": "Rob Houghton portrait"
};

export function SettingsPage() {
    const { settings, projects, notes, tasks, service, ready } = useStore();
    const workflows = useWorkflows();
    const toast = useToast();

    const [displayName, setDisplayName] = useState(settings.displayName);
    const [email, setEmail] = useState(settings.email);
    const [profileError, setProfileError] = useState<string | null>(null);
    useEffect(() => {
        setDisplayName(settings.displayName);
        setEmail(settings.email);
    }, [settings.displayName, settings.email]);
    const [savingProfile, setSavingProfile] = useState(false);

    const [importPayload, setImportPayload] = useState<{ backup: BackupFile; preview: ImportPreview; fileName: string } | null>(null);
    const [importMode, setImportMode] = useState<ImportMode>("merge");
    const [importError, setImportError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [busyAction, setBusyAction] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const counts = useMemo(
        () => ({ projects: projects.length, notes: notes.length, tasks: tasks.length }),
        [projects, notes, tasks]
    );

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    async function saveProfile(event: React.FormEvent) {
        event.preventDefault();
        setProfileError(null);
        setSavingProfile(true);
        try {
            await service.settings.update({ displayName, email });
            toast.success("Profile saved.");
        } catch (error) {
            setProfileError(describeError(error));
        } finally {
            setSavingProfile(false);
        }
    }

    async function toggleSetting(patch: Partial<Pick<SettingsRecord, "projectsExpanded" | "completedTasksVisible" | "showWeekends" | "demoDragState">>) {
        try {
            await service.settings.update(patch);
        } catch (error) {
            toast.error(describeError(error));
        }
    }

    async function exportData() {
        try {
            const backup = await service.exportBackup();
            const blob = new Blob([JSON.stringify(backup, null, 4)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const stamp = new Date().toISOString().slice(0, 10);
            link.href = url;
            link.download = `notes-backup-${stamp}.json`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 4000);
            toast.success("Backup exported.");
        } catch (error) {
            toast.error(describeError(error));
        }
    }

    async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setImportError(null);
        try {
            const text = await file.text();
            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            } catch {
                throw new Error("That file is not valid JSON.");
            }
            const { backup, preview } = service.validateImport(parsed);
            const allIds = new Set([...backup.projects, ...backup.notes, ...backup.tasks].map((row) => row.id));
            const currentIds = new Set([...projects, ...notes, ...tasks].map((row) => row.id));
            setImportMode("merge");
            setImportPayload({
                backup,
                preview: { ...preview, conflicts: [...allIds].filter((id) => currentIds.has(id)).length },
                fileName: file.name
            });
        } catch (error) {
            setImportPayload(null);
            setImportError(error instanceof Error ? error.message : "Could not read that backup file.");
        }
    }

    async function confirmImport() {
        if (!importPayload) return;
        setImporting(true);
        try {
            await service.applyImport(importPayload.backup, importMode);
            toast.success(importMode === "replace" ? "Workspace replaced." : "Backup merged.");
            setImportPayload(null);
        } catch (error) {
            toast.error(describeError(error));
        } finally {
            setImporting(false);
        }
    }

    async function runPendingAction() {
        if (!pendingAction) return;
        setBusyAction(true);
        try {
            if (pendingAction === "demo") {
                await service.restoreDemo();
                toast.success("Demo workspace restored.");
            } else {
                await service.clearAll();
                toast.success("All local data cleared.");
            }
            setPendingAction(null);
        } catch (error) {
            toast.error(describeError(error));
        } finally {
            setBusyAction(false);
        }
    }

    return (
        <div className="page settings-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "home" })}>
                    <ArrowLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                    Home
                </button>
            </div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Everything stays on this device. Nothing is uploaded anywhere.</p>
                </div>
            </header>

            <section className="settings-section panel">
                <h2 className="settings-heading">Profile</h2>
                <form className="settings-form" onSubmit={saveProfile}>
                    <div className="avatar-picker" role="radiogroup" aria-label="Profile picture">
                        {AVATAR_IDS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={settings.avatarId === id}
                                aria-label={AVATARS_LABEL[id]}
                                className={`avatar-choice${settings.avatarId === id ? " is-selected" : ""}`}
                                onClick={() => {
                                    void service.settings.update({ avatarId: id });
                                }}
                            >
                                <Avatar id={id} name={AVATARS_LABEL[id]} size={40} />
                            </button>
                        ))}
                    </div>
                    <label className="field">
                        <span className="field-label">Display name</span>
                        <input
                            className="text-input"
                            value={displayName}
                            maxLength={60}
                            onChange={(event) => setDisplayName(event.target.value)}
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Email</span>
                        <input
                            className="text-input"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </label>
                    {profileError ? (
                        <p className="form-error" role="alert">
                            {profileError}
                        </p>
                    ) : null}
                    <div>
                        <button type="submit" className="button button-primary button-small" disabled={savingProfile}>
                            Save profile
                        </button>
                    </div>
                </form>
            </section>

            <section className="settings-section panel">
                <h2 className="settings-heading">Preferences</h2>
                <label className="toggle-row">
                    <span>
                        <span className="toggle-title">Show completed tasks on the dashboard</span>
                        <span className="toggle-text">Completed tasks appear with a checked box and muted text.</span>
                    </span>
                    <input
                        type="checkbox"
                        className="switch"
                        checked={settings.completedTasksVisible}
                        onChange={(event) => void toggleSetting({ completedTasksVisible: event.target.checked })}
                    />
                </label>
                <label className="toggle-row">
                    <span>
                        <span className="toggle-title">Show the sidebar drag preview</span>
                        <span className="toggle-text">
                            On first launch the dashboard shows the folder and note cards in a drag state, following the
                            reference design. Turn it off for a static layout.
                        </span>
                    </span>
                    <input
                        type="checkbox"
                        className="switch"
                        checked={settings.demoDragState}
                        onChange={(event) => void toggleSetting({ demoDragState: event.target.checked })}
                    />
                </label>
            </section>

            <section className="settings-section panel">
                <h2 className="settings-heading">Your data</h2>
                <p className="settings-text">
                    {counts.projects} projects · {counts.notes} notes · {counts.tasks} tasks stored in the local
                    IndexedDB database of this app.
                </p>
                <div className="settings-actions">
                    <button type="button" className="button button-ghost button-small" onClick={() => void exportData()}>
                        <Download size={14} strokeWidth={1.8} aria-hidden="true" />
                        Export JSON
                    </button>
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
                        Import JSON
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={handleFile}
                        aria-label="Choose a JSON backup"
                    />
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => setPendingAction("demo")}
                    >
                        <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                        Restore demo data
                    </button>
                    <button
                        type="button"
                        className="button button-danger-ghost button-small"
                        onClick={() => setPendingAction("clear")}
                    >
                        <ShieldAlert size={14} strokeWidth={1.8} aria-hidden="true" />
                        Reset local data
                    </button>
                </div>
                {importError ? (
                    <p className="form-error" role="alert">
                        {importError}
                    </p>
                ) : null}
            </section>

            <section className="settings-section panel">
                <h2 className="settings-heading">About</h2>
                <dl className="about-list">
                    <div>
                        <dt>Version</dt>
                        <dd>1.0.0</dd>
                    </div>
                    <div>
                        <dt>Storage</dt>
                        <dd>IndexedDB, local to this profile</dd>
                    </div>
                    <div>
                        <dt>Network</dt>
                        <dd>Works fully offline. No accounts, no telemetry.</dd>
                    </div>
                    <div>
                        <dt>Created</dt>
                        <dd>{formatFullDate(notes[0]?.createdAt ?? new Date().toISOString())}</dd>
                    </div>
                </dl>
            </section>

            <Modal
                open={Boolean(importPayload)}
                title="Import backup"
                size="small"
                onClose={() => setImportPayload(null)}
                footer={
                    <>
                        <button type="button" className="button button-ghost" onClick={() => setImportPayload(null)}>
                            Cancel
                        </button>
                        <button type="button" className="button button-primary" data-primary onClick={confirmImport} disabled={importing}>
                            {importMode === "replace" ? "Replace workspace" : "Merge backup"}
                        </button>
                    </>
                }
            >
                {importPayload ? (
                    <div className="confirm-body">
                        <p>
                            <strong>{importPayload.fileName}</strong> exported{" "}
                            {formatFullDate(importPayload.preview.exportedAt ?? new Date().toISOString())}
                        </p>
                        <ul className="preview-list">
                            <li>{importPayload.preview.projects} projects</li>
                            <li>{importPayload.preview.notes} notes</li>
                            <li>{importPayload.preview.tasks} tasks</li>
                            <li>
                                {importPayload.preview.conflicts} item
                                {importPayload.preview.conflicts === 1 ? "" : "s"} already exist in this workspace
                            </li>
                        </ul>
                        <div className="choice-list" role="radiogroup" aria-label="Import mode">
                            <label className={`choice${importMode === "merge" ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name="import-mode"
                                    checked={importMode === "merge"}
                                    onChange={() => setImportMode("merge")}
                                />
                                <span>
                                    <span className="choice-title">Merge</span>
                                    <span className="choice-text">
                                        Keep current data. Items with the same id are overwritten by the backup.
                                    </span>
                                </span>
                            </label>
                            <label className={`choice${importMode === "replace" ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name="import-mode"
                                    checked={importMode === "replace"}
                                    onChange={() => setImportMode("replace")}
                                />
                                <span>
                                    <span className="choice-title">Replace</span>
                                    <span className="choice-text">
                                        Delete current projects, notes and tasks first. Export a backup if unsure.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>
                ) : null}
            </Modal>

            <ConfirmDialog
                open={pendingAction !== null}
                title={pendingAction === "clear" ? "Reset all local data?" : "Restore demo data?"}
                confirmLabel={pendingAction === "clear" ? "Delete everything" : "Restore demo data"}
                tone={pendingAction === "clear" ? "danger" : "primary"}
                busy={busyAction}
                onCancel={() => setPendingAction(null)}
                onConfirm={() => void runPendingAction()}
            >
                <p>
                    {pendingAction === "clear"
                        ? "Every project, note and task in this workspace will be deleted. Export a backup first if you want to keep anything."
                        : "This replaces the current projects, notes, tasks and activity with the original demo workspace."}
                </p>
                <p className="confirm-muted">This cannot be undone.</p>
            </ConfirmDialog>
        </div>
    );
}

