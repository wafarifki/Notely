import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ─── OLD CODE (kept for reference) ───
// import { ArrowLeft, Check, List as ListIcon, ListOrdered, MoreHorizontal, Pin, Save, Star, Trash2 } from "lucide-react";
// ─── NEW: ListIcon/ListOrdered moved into RichTextEditor's toolbar. ───
import { ArrowLeft, Check, MoreHorizontal, Pin, Save, Star, Trash2 } from "lucide-react";
import { describeError, useStore } from "@/app/store";
import { Popover, PopoverDivider, PopoverItem } from "@/components/Popover";
import { EmptyState } from "@/components/EmptyState";
import type { NoteRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { sanitizeNoteHtml } from "@/lib/noteContent";
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

    const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);

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
                <PopoverDivider />
                <PopoverItem onSelect={() => { setMenuOpen(false); titleRef.current?.focus(); }}>
                    {t("note.editTitle")}
                </PopoverItem>
            </Popover>
        </div>
    );
}
