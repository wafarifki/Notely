import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ─── OLD CODE (kept for reference) ───
// import { ArrowLeft, Check, List as ListIcon, ListOrdered, MoreHorizontal, Pin, Save, Star, Trash2 } from "lucide-react";
// ─── NEW: ListIcon/ListOrdered moved into RichTextEditor's toolbar. ───
import {
    ArrowLeft,
    Check,
    ClipboardCopy,
    Download,
    FileText,
    Link2,
    MoreHorizontal,
    Pin,
    Save,
    Star,
    Trash2
} from "lucide-react";
import { describeError, useStore } from "@/app/store";
import { Popover, PopoverDivider, PopoverItem, PopoverLabel } from "@/components/Popover";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toasts";
import type { NoteRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { htmlToPlainText, sanitizeNoteHtml } from "@/lib/noteContent";
import { buildNoteExport, htmlToMarkdown } from "@/lib/noteExport";
import { getDesktopBridge } from "@/platform/desktop";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";
import { TagChip } from "./TagChip";
import { RichTextEditor } from "./RichTextEditor";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface Draft {
    title: string;
    content: string;
    projectId: string | null;
    tags: string[];
    pinned: boolean;
    favorite: boolean;
}

function draftFromNote(note: NoteRecord): Draft {
    return {
        title: note.title,
        content: note.content,
        projectId: note.projectId,
        tags: note.tags,
        pinned: note.pinned,
        favorite: note.favorite
    };
}

function draftsEqual(a: Draft, b: Draft): boolean {
    return (
        a.title === b.title &&
        a.content === b.content &&
        a.projectId === b.projectId &&
        a.pinned === b.pinned &&
        a.favorite === b.favorite &&
        a.tags.length === b.tags.length &&
        a.tags.every((tag, index) => tag === b.tags[index])
    );
}

export function NoteEditorPage({ noteId, focusTitle }: { noteId: string; focusTitle?: boolean }) {
    const { notes, projects, ready, service } = useStore();
    const workflows = useWorkflows();
    const { t } = useI18n();
    const note = notes.find((row) => row.id === noteId);

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    if (!note) {
        return (
            <div className="page">
                <div className="panel">
                    <EmptyState
                        icon={Save}
                        title={t("note.notFoundTitle")}
                        description={t("note.notFoundText")}
                        action={
                            <button
                                type="button"
                                className="button button-primary button-small"
                                onClick={() => workflows.go({ name: "notes" })}
                            >
                                {t("note.backToNotes")}
                            </button>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <NoteEditor
            key={note.id}
            note={note}
            projects={projects}
            service={service}
            workflows={workflows}
            focusTitle={focusTitle}
        />
    );
}

function NoteEditor({
    note,
    projects,
    service,
    workflows,
    focusTitle
}: {
    note: NoteRecord;
    projects: ReturnType<typeof useStore>["projects"];
    service: ReturnType<typeof useStore>["service"];
    workflows: ReturnType<typeof useWorkflows>;
    focusTitle?: boolean;
}) {
    const [draft, setDraft] = useState<Draft>(() => draftFromNote(note));
    const { t, language } = useI18n();
    const toast = useToast();
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const savedDraftRef = useRef<Draft>(draftFromNote(note));
    const timerRef = useRef<number | null>(null);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    // ─── NEW: guards the export/copy buttons while the native dialog is open,
    // so a double click cannot spawn two save dialogs. ───
    const [busy, setBusy] = useState(false);

    const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);

    /**
     * ─── NEW: export the note ───
     * The unsaved draft is used, not the stored copy, so what the user sees is
     * what ends up in the file even if the debounced autosave has not fired.
     */
    const exportNote = useCallback(
        async (format: "markdown" | "text") => {
            const bridge = getDesktopBridge();
            const values = draftRef.current;
            const fallback = t("common.untitledNote");
            const { fileName, body } = buildNoteExport(values, format, fallback);

            if (!bridge) {
                // Browser preview has no save dialog: hand the text to the OS
                // download flow instead so the action is never a dead end.
                const blob = new Blob([body], { type: format === "markdown" ? "text/markdown" : "text/plain" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = fileName;
                anchor.click();
                URL.revokeObjectURL(url);
                return;
            }

            setBusy(true);
            try {
                const result = await bridge.saveExport(fileName, body);
                if (result.ok) toast.success(t("toast.noteExported"));
                else if (!result.canceled) toast.error(t("toast.noteExportFailed"));
            } catch (error) {
                toast.error(describeError(error));
            } finally {
                setBusy(false);
            }
        },
        [t, toast]
    );

    /** ─── NEW: put the note on the clipboard in the requested flavour. */
    const copyNote = useCallback(
        async (format: "rich" | "markdown" | "text" | "link") => {
            const bridge = getDesktopBridge();
            const values = draftRef.current;
            const url = `#/notes/${note.id}`;

            let text: string;
            let html: string | undefined;
            if (format === "markdown") {
                text = htmlToMarkdown(values.content);
            } else if (format === "text") {
                text = htmlToPlainText(values.content);
            } else if (format === "link") {
                text = url;
            } else {
                // Rich: keep the formatting for Word/Docs, plain text for the
                // fallback target. The title is included so the paste is useful
                // on its own.
                text = `${values.title}\n\n${htmlToPlainText(values.content)}`.trim();
                html = `<h1>${values.title || ""}</h1>${sanitizeNoteHtml(values.content)}`;
            }

            try {
                if (bridge) {
                    await bridge.copyNote(text, html);
                } else {
                    await navigator.clipboard.writeText(text);
                }
                toast.success(t("toast.noteCopied"));
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [note.id, t, toast]
    );

    const saveNow = useCallback(
        async (values: Draft) => {
            if (draftsEqual(values, savedDraftRef.current)) {
                setSaveState((state) => (state === "dirty" ? "idle" : state));
                return;
            }
            setSaveState("saving");
            setSaveError(null);
            try {
                await service.updateNote(note.id, {
                    title: values.title,
                    // ─── NEW: never persist markup we did not allowlist. ───
                    content: sanitizeNoteHtml(values.content),
                    projectId: values.projectId,
                    tags: values.tags
                });
                savedDraftRef.current = { ...values };
                setSaveState(draftsEqual(draftRef.current, values) ? "saved" : "saving");
            } catch (error) {
                setSaveState("error");
                setSaveError(describeError(error));
            }
        },
        [note.id, service]
    );

    const scheduleSave = useCallback(
        (values: Draft) => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            setSaveState("dirty");
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                void saveNow(values);
            }, 650);
        },
        [saveNow]
    );

    const updateDraft = useCallback(
        (patch: Partial<Draft>, immediate = false) => {
            const next = { ...draftRef.current, ...patch };
            setDraft(next);
            draftRef.current = next;
            if (immediate) {
                if (timerRef.current) window.clearTimeout(timerRef.current);
                void saveNow(next);
            } else {
                scheduleSave(next);
            }
        },
        [saveNow, scheduleSave]
    );

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (draftsEqual(draftRef.current, savedDraftRef.current)) return;
            const values = draftRef.current;
            void service.updateNote(note.id, {
                title: values.title,
                content: values.content,
                projectId: values.projectId,
                tags: values.tags
            });
            event.preventDefault();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
                if (!draftsEqual(draftRef.current, savedDraftRef.current)) {
                    const values = draftRef.current;
                    void service.updateNote(note.id, {
                        title: values.title,
                        content: values.content,
                        projectId: values.projectId,
                        tags: values.tags
                    });
                }
            }
        };
    }, [note.id, service]);

    useEffect(() => {
        setSaveState((state) => {
            if (state === "saving") return draftsEqual(draftRef.current, savedDraftRef.current) ? "saved" : "saving";
            return state;
        });
    }, [note.updatedAt]);

    useEffect(() => {
        if (focusTitle) titleRef.current?.focus();
    }, [focusTitle]);

    function addTag(raw: string) {
        const tag = raw.trim().replace(/\s+/g, " ");
        if (!tag) return;
        if (draft.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
            setTagInput("");
            return;
        }
        updateDraft({ tags: [...draft.tags, tag].slice(0, 12) }, true);
        setTagInput("");
    }

    function removeTag(tag: string) {
        updateDraft({ tags: draft.tags.filter((existing) => existing !== tag) }, true);
    }

    function toggleFlag(flag: "pinned" | "favorite") {
        const next = !draftRef.current[flag];
        updateDraft({ [flag]: next }, true);
        void service.toggleNoteFlag(note.id, flag).catch(() => {
            updateDraft({ [flag]: !next }, true);
        });
    }

    // ─── OLD CODE (kept for reference) ───
    // Superseded by the WYSIWYG toolbar; the function only manipulated a plain
    // textarea, which no longer exists in this view.
    // function applyFormat(kind: "bullet" | "numbered") {
    //     const textarea = contentRef.current;
    //     if (!textarea) return;
    //     const { selectionStart, selectionEnd, value } = textarea;
    //     const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    //     const selected = value.slice(lineStart, selectionEnd);
    //     const prefix = kind === "bullet" ? "• " : "1. ";
    //     const lines = selected.split("\n");
    //     const numbered = lines.map((line, index) => `${kind === "numbered" ? `${index + 1}. ` : prefix}${line}`);
    //     const replacement = numbered.join("\n");
    //     const nextValue = value.slice(0, lineStart) + replacement + value.slice(selectionEnd);
    //     updateDraft({ content: nextValue });
    //     requestAnimationFrame(() => {
    //         textarea.focus();
    //         textarea.setSelectionRange(lineStart + replacement.length, lineStart + replacement.length);
    //     });
    // }

    const saveLabel: Record<SaveState, string> = {
        idle: t("note.editedOn", { date: formatFullDate(note.updatedAt, language) }),
        dirty: t("note.unsaved"),
        saving: t("note.saving"),
        saved: t("note.saved"),
        error: t("note.unableToSave")
    };

    return (
        <div className="page note-editor-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "notes" })}>
                    <ArrowLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                    {t("notes.title")}
                </button>
                <div className="page-topbar-actions">
                    <span className={`save-status save-${saveState}`} role="status" aria-live="polite">
                        {saveState === "saved" ? <Check size={12} strokeWidth={2.4} aria-hidden="true" /> : null}
                        {saveLabel[saveState]}
                    </span>
                    <button
                        type="button"
                        className={`icon-toggle${draft.pinned ? " is-active" : ""}`}
                        aria-pressed={draft.pinned}
                        aria-label={draft.pinned ? t("note.unpin") : t("note.pin")}
                        title={draft.pinned ? t("note.unpin") : t("note.pin")}
                        onClick={() => toggleFlag("pinned")}
                    >
                        <Pin size={15} strokeWidth={1.8} fill={draft.pinned ? "currentColor" : "none"} />
                    </button>
                    <button
                        type="button"
                        className={`icon-toggle${draft.favorite ? " is-active" : ""}`}
                        aria-pressed={draft.favorite}
                        aria-label={draft.favorite ? t("note.removeFavorite") : t("note.addFavorite")}
                        title={draft.favorite ? t("note.removeFavorite") : t("note.addFavorite")}
                        onClick={() => toggleFlag("favorite")}
                    >
                        <Star size={15} strokeWidth={1.8} fill={draft.favorite ? "currentColor" : "none"} />
                    </button>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label={t("note.moreActions")}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={(event) => {
                            setMenuAnchor(event.currentTarget);
                            setMenuOpen((open) => !open);
                        }}
                    >
                        <MoreHorizontal size={16} strokeWidth={2} />
                    </button>
                </div>
            </div>

            <div className="note-editor">
                <input
                    ref={titleRef}
                    className="note-editor-title"
                    value={draft.title}
                    placeholder={t("note.titlePlaceholder")}
                    maxLength={200}
                    aria-label={t("note.titleLabel")}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            contentRef.current?.focus();
                        }
                    }}
                />

                <div className="note-editor-meta">
                    <label className="inline-field">
                        <span>{t("common.project")}</span>
                        <select
                            className="text-input select-input select-inline"
                            value={draft.projectId ?? ""}
                            onChange={(event) => updateDraft({ projectId: event.target.value || null }, true)}
                        >
                            <option value="">{t("common.unassigned")}</option>
                            {activeProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="note-editor-date">
                        {t("note.createdOn", { date: formatFullDate(note.createdAt, language) })}
                    </span>
                </div>

                {/* ─── OLD CODE (kept for reference) ───
                <div className="note-editor-toolbar" role="toolbar" aria-label={t("note.formatting")}>
                    ... list / numbered buttons operating on a plain textarea ...
                </div>

                <textarea
                    ref={contentRef}
                    className="note-editor-content"
                    value={draft.content}
                    placeholder={t("note.contentPlaceholder")}
                    aria-label={t("note.contentLabel")}
                    onChange={(event) => updateDraft({ content: event.target.value })}
                />
                ─── NEW: the body is a WYSIWYG surface. Legacy plain-text notes are
                converted on load, and every write is sanitised before it lands in
                the database. ─── */}
                <RichTextEditor
                    value={draft.content}
                    onChange={(html) => updateDraft({ content: html })}
                    placeholder={t("note.contentPlaceholder")}
                    ariaLabel={t("note.contentLabel")}
                />

                <div className="note-editor-tags">
                    <span className="field-label">{t("note.tags")}</span>
                    <div className="tag-editor">
                        {draft.tags.map((tag) => (
                            <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
                        ))}
                        <input
                            className="tag-input"
                            value={tagInput}
                            placeholder={t("note.addTag")}
                            aria-label={t("note.addTagLabel")}
                            onChange={(event) => setTagInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === ",") {
                                    event.preventDefault();
                                    addTag(tagInput);
                                } else if (event.key === "Backspace" && !tagInput && draft.tags.length > 0) {
                                    removeTag(draft.tags[draft.tags.length - 1]);
                                }
                            }}
                            onBlur={() => addTag(tagInput)}
                        />
                    </div>
                </div>

                {saveState === "error" ? (
                    <div className="inline-error" role="alert">
                        <span>{saveError ?? t("note.saveFailedBody")}</span>
                        <button type="button" className="button button-small button-ghost" onClick={() => void saveNow(draftRef.current)}>
                            {t("note.retry")}
                        </button>
                    </div>
                ) : null}
            </div>

            <Popover open={menuOpen} anchor={menuAnchor} onClose={() => setMenuOpen(false)} label={t("noteMenu.label")}>
                {/* ─── NEW: export the note as Markdown or plain text. ─── */}
                <PopoverLabel>{t("noteMenu.export")}</PopoverLabel>
                <PopoverItem
                    icon={<Download size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        if (busy) return;
                        setMenuOpen(false);
                        void exportNote("markdown");
                    }}
                >
                    {t("noteMenu.exportMarkdown")}
                </PopoverItem>
                <PopoverItem
                    icon={<FileText size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        if (busy) return;
                        setMenuOpen(false);
                        void exportNote("text");
                    }}
                >
                    {t("noteMenu.exportText")}
                </PopoverItem>
                <PopoverDivider />

                {/* ─── NEW: copy the note in the format the paste target needs. ─── */}
                <PopoverLabel>{t("noteMenu.copy")}</PopoverLabel>
                <PopoverItem
                    icon={<ClipboardCopy size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        void copyNote("rich");
                    }}
                >
                    {t("noteMenu.copyRichText")}
                </PopoverItem>
                <PopoverItem
                    icon={<ClipboardCopy size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        void copyNote("markdown");
                    }}
                >
                    {t("noteMenu.copyMarkdown")}
                </PopoverItem>
                <PopoverItem onSelect={() => { setMenuOpen(false); void copyNote("text"); }}>
                    {t("noteMenu.copyText")}
                </PopoverItem>
                <PopoverItem
                    icon={<Link2 size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        void copyNote("link");
                    }}
                >
                    {t("noteMenu.copyLink")}
                </PopoverItem>
                <PopoverDivider />

                <PopoverItem
                    danger
                    icon={<Trash2 size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        workflows.requestDeleteNote(note);
                    }}
                >
                    {t("noteMenu.delete")}
                </PopoverItem>
                <PopoverItem onSelect={() => { setMenuOpen(false); titleRef.current?.focus(); }}>
                    {t("note.editTitle")}
                </PopoverItem>
            </Popover>
        </div>
    );
}
