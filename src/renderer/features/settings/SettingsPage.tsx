import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Download, Gift, Github, LifeBuoy, ShieldCheck, Trash2, Upload } from "lucide-react";
import { describeError, useStore } from "@/app/store";
import { Avatar, AVATAR_IDS, readImageFileAsSquareDataUrl } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toasts";
import type { BackupFile, ImportMode, ImportPreview } from "@/db/backup";
import type { SettingsRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";
import { LANGUAGE_OPTIONS } from "@/i18n/translations";
import { AppearanceSection } from "./AppearanceSection";

type PendingAction = "clear" | null;

const GITHUB_URL = "https://github.com/wafarifki/Notely";

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
    const { t, language } = useI18n();

    const [displayName, setDisplayName] = useState(settings.displayName);
    const [email, setEmail] = useState(settings.email);
    const [profileError, setProfileError] = useState<string | null>(null);
    useEffect(() => {
        setDisplayName(settings.displayName);
        setEmail(settings.email);
    }, [settings.displayName, settings.email]);
    const [savingProfile, setSavingProfile] = useState(false);

    // ─── NEW: uploaded profile photo state. ───
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);

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
            toast.success(t("profile.saved"));
        } catch (error) {
            setProfileError(describeError(error));
        } finally {
            setSavingProfile(false);
        }
    }

    // ─── NEW: read the chosen file, crop it to a square and store it inline. ───
    async function handleAvatarFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setAvatarError(null);
        setUploadingAvatar(true);
        try {
            const dataUrl = await readImageFileAsSquareDataUrl(file);
            await service.settings.update({
                avatarImage: dataUrl,
                avatarImageUpdatedAt: new Date().toISOString()
            });
            toast.success(t("profile.photoUpdated"));
        } catch (error) {
            setAvatarError(describeError(error));
        } finally {
            setUploadingAvatar(false);
        }
    }

    async function removeAvatarImage() {
        setAvatarError(null);
        try {
            await service.settings.update({ avatarImage: null, avatarImageUpdatedAt: null });
            toast.success(t("profile.photoRemoved"));
        } catch (error) {
            setAvatarError(describeError(error));
        }
    }

    async function toggleSetting(patch: Partial<SettingsRecord>) {
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
            toast.success(t("data.backupExported"));
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
                throw new Error(t("import.invalidJson"));
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
            setImportError(error instanceof Error ? error.message : t("import.unreadable"));
        }
    }

    async function confirmImport() {
        if (!importPayload) return;
        setImporting(true);
        try {
            await service.applyImport(importPayload.backup, importMode);
            toast.success(t(importMode === "replace" ? "import.workspaceReplaced" : "import.backupMerged"));
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
            await service.clearAll();
            toast.success(t("data.resetDone"));
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
                    {t("nav.home")}
                </button>
            </div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">{t("settings.title")}</h1>
                    <p className="page-subtitle">{t("settings.subtitle")}</p>
                </div>
            </header>

            <section className="settings-section panel">
                <h2 className="settings-heading">{t("settings.profile")}</h2>
                <form className="settings-form" onSubmit={saveProfile}>
                    {/* ─── NEW: uploaded photo sits above the preset picker. ─── */}
                    <div className="avatar-upload">
                        <Avatar
                            id={settings.avatarId}
                            name={settings.displayName}
                            size={72}
                            image={settings.avatarImage ?? null}
                        />
                        <div className="avatar-upload-actions">
                            <button
                                type="button"
                                className="button button-ghost button-small"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={uploadingAvatar}
                            >
                                <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
                                {uploadingAvatar ? t("profile.uploading") : t("profile.uploadPhoto")}
                            </button>
                            {settings.avatarImage ? (
                                <button
                                    type="button"
                                    className="button button-ghost button-small"
                                    onClick={() => void removeAvatarImage()}
                                    disabled={uploadingAvatar}
                                >
                                    <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                                    {t("profile.removePhoto")}
                                </button>
                            ) : null}
                            <span className="field-hint">{t("profile.uploadHint")}</span>
                        </div>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                            className="sr-only"
                            onChange={handleAvatarFile}
                            aria-label={t("a11y.chooseAvatar")}
                        />
                    </div>
                    {avatarError ? (
                        <p className="form-error" role="alert">
                            {avatarError}
                        </p>
                    ) : null}
                    <div className="avatar-picker" role="radiogroup" aria-label={t("profile.presetLabel")}>
                        {AVATAR_IDS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={settings.avatarId === id && !settings.avatarImage}
                                aria-label={AVATARS_LABEL[id]}
                                className={`avatar-choice${settings.avatarId === id && !settings.avatarImage ? " is-selected" : ""}`}
                                onClick={() => {
                                    void service.settings.update({ avatarId: id, avatarImage: null });
                                }}
                            >
                                <Avatar id={id} name={AVATARS_LABEL[id]} size={40} />
                            </button>
                        ))}
                    </div>
                    <label className="field">
                        <span className="field-label">{t("profile.displayName")}</span>
                        <input
                            className="text-input"
                            value={displayName}
                            maxLength={60}
                            onChange={(event) => setDisplayName(event.target.value)}
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">{t("profile.email")}</span>
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
                            {t("profile.save")}
                        </button>
                    </div>
                </form>
            </section>

            <AppearanceSection settings={settings} />

            {/* ─── NEW: language switch. English stays the default. ─── */}
            <section className="settings-section panel">
                <h2 className="settings-heading">{t("settings.language")}</h2>
                <div className="theme-options" role="radiogroup" aria-label={t("settings.language")}>
                    {LANGUAGE_OPTIONS.map((option) => {
                        const selected = language === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                className={`theme-option${selected ? " is-selected" : ""}`}
                                onClick={() => void toggleSetting({ language: option.value })}
                            >
                                <span className="theme-option-text">
                                    <span className="theme-option-label">{t(option.labelKey)}</span>
                                </span>
                                {selected ? (
                                    <Check className="theme-option-check" size={14} strokeWidth={2.4} aria-hidden="true" />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                <p className="settings-text">{t("language.hint")}</p>
            </section>

            <section className="settings-section panel">
                <h2 className="settings-heading">{t("settings.preferences")}</h2>
                <label className="toggle-row">
                    <span>
                        <span className="toggle-title">{t("preferences.completedTasks")}</span>
                        <span className="toggle-text">{t("preferences.completedTasksHint")}</span>
                    </span>
                    <input
                        type="checkbox"
                        className="switch"
                        checked={settings.completedTasksVisible}
                        onChange={(event) => void toggleSetting({ completedTasksVisible: event.target.checked })}
                    />
                </label>
            </section>

            <section className="settings-section panel">
                <h2 className="settings-heading">{t("settings.yourData")}</h2>
                <p className="settings-text">
                    {t("data.summary", {
                        projects: counts.projects,
                        notes: counts.notes,
                        tasks: counts.tasks
                    })}
                </p>
                <div className="settings-actions">
                    <button type="button" className="button button-ghost button-small" onClick={() => void exportData()}>
                        <Download size={14} strokeWidth={1.8} aria-hidden="true" />
                        {t("data.export")}
                    </button>
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
                        {t("data.import")}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={handleFile}
                        aria-label={t("data.chooseBackup")}
                    />
                    <button
                        type="button"
                        className="button button-danger-ghost button-small"
                        onClick={() => setPendingAction("clear")}
                    >
                        <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                        {t("data.reset")}
                    </button>
                </div>
                {importError ? (
                    <p className="form-error" role="alert">
                        {importError}
                    </p>
                ) : null}
            </section>

            {/* ─── NEW: Support, What's new and Privacy Policy moved out of the
            sidebar and now live in Settings, directly above the About card. ─── */}
            <section className="settings-section panel">
                <h2 className="settings-heading">{t("settings.helpLegal")}</h2>
                <div className="settings-link-list">
                    <button
                        type="button"
                        className="settings-link-row"
                        onClick={() => workflows.go({ name: "support" })}
                    >
                        <span className="settings-link-icon" aria-hidden="true">
                            <LifeBuoy size={15} strokeWidth={1.8} />
                        </span>
                        <span className="settings-link-text">
                            <span className="settings-link-title">{t("sidebar.support")}</span>
                            <span className="settings-link-hint">{t("settings.supportHint")}</span>
                        </span>
                        <ChevronRight size={15} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="settings-link-row"
                        onClick={() => workflows.go({ name: "whats-new" })}
                    >
                        <span className="settings-link-icon" aria-hidden="true">
                            <Gift size={15} strokeWidth={1.8} />
                        </span>
                        <span className="settings-link-text">
                            <span className="settings-link-title">{t("sidebar.whatsNew")}</span>
                            <span className="settings-link-hint">{t("settings.whatsNewHint")}</span>
                        </span>
                        <ChevronRight size={15} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="settings-link-row"
                        onClick={() => workflows.go({ name: "privacy" })}
                    >
                        <span className="settings-link-icon" aria-hidden="true">
                            <ShieldCheck size={15} strokeWidth={1.8} />
                        </span>
                        <span className="settings-link-text">
                            <span className="settings-link-title">{t("sidebar.privacy")}</span>
                            <span className="settings-link-hint">{t("settings.privacyHint")}</span>
                        </span>
                        <ChevronRight size={15} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                </div>
            </section>

            <section className="settings-section panel" data-tour="about-credits">
                <h2 className="settings-heading">{t("settings.about")}</h2>
                <p className="settings-text">
                    {t("about.builtBy")} <strong>Faceindo Developer Team</strong>. {t("about.credits")}
                </p>
                <div className="settings-actions">
                    <a
                        className="button button-ghost button-small"
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        <Github size={14} strokeWidth={1.8} aria-hidden="true" />
                        github.com/wafarifki/Notely
                    </a>
                </div>
                <dl className="about-list">
                    <div>
                        <dt>{t("about.version")}</dt>
                        <dd>1.0.0</dd>
                    </div>
                    <div>
                        <dt>{t("about.license")}</dt>
                        <dd>MIT</dd>
                    </div>
                    <div>
                        <dt>{t("about.storage")}</dt>
                        <dd>{t("about.storageValue")}</dd>
                    </div>
                    <div>
                        <dt>{t("about.network")}</dt>
                        <dd>{t("about.networkValue")}</dd>
                    </div>
                </dl>
            </section>

            <Modal
                open={Boolean(importPayload)}
                title={t("import.title")}
                size="small"
                onClose={() => setImportPayload(null)}
                footer={
                    <>
                        <button type="button" className="button button-ghost" onClick={() => setImportPayload(null)}>
                            {t("import.cancel")}
                        </button>
                        <button type="button" className="button button-primary" data-primary onClick={confirmImport} disabled={importing}>
                            {t(importMode === "replace" ? "import.replaceAction" : "import.mergeAction")}
                        </button>
                    </>
                }
            >
                {importPayload ? (
                    <div className="confirm-body">
                        <p>
                            <strong>{importPayload.fileName}</strong> {t("import.exportedOn")}{" "}
                            {formatFullDate(importPayload.preview.exportedAt ?? new Date().toISOString())}
                        </p>
                        <ul className="preview-list">
                            <li>
                                {importPayload.preview.projects} {t("nav.projects").toLowerCase()}
                            </li>
                            <li>
                                {importPayload.preview.notes} {t("nav.notes").toLowerCase()}
                            </li>
                            <li>
                                {importPayload.preview.tasks} {t("nav.tasks").toLowerCase()}
                            </li>
                            <li>
                                {t(
                                    importPayload.preview.conflicts === 1
                                        ? "import.alreadyExist"
                                        : "import.alreadyExistPlural",
                                    { count: importPayload.preview.conflicts }
                                )}
                            </li>
                        </ul>
                        <div className="choice-list" role="radiogroup" aria-label={t("import.title")}>
                            <label className={`choice${importMode === "merge" ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name="import-mode"
                                    checked={importMode === "merge"}
                                    onChange={() => setImportMode("merge")}
                                />
                                <span>
                                    <span className="choice-title">{t("import.merge")}</span>
                                    <span className="choice-text">{t("import.mergeHint")}</span>
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
                                    <span className="choice-title">{t("import.replace")}</span>
                                    <span className="choice-text">{t("import.replaceHint")}</span>
                                </span>
                            </label>
                        </div>
                    </div>
                ) : null}
            </Modal>

            <ConfirmDialog
                open={pendingAction !== null}
                title={t("data.resetTitle")}
                confirmLabel={t("data.resetConfirm")}
                tone="danger"
                busy={busyAction}
                onCancel={() => setPendingAction(null)}
                onConfirm={() => void runPendingAction()}
            >
                <p>{t("data.resetBody")}</p>
                <p className="confirm-muted">{t("data.resetCannotUndo")}</p>
            </ConfirmDialog>
        </div>
    );
}

