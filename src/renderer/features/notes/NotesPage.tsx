import { useMemo, useState } from "react";
import { ArrowDownAZ, FileText, Filter, Plus, Search, Star, Pin, X } from "lucide-react";
import { useStore } from "@/app/store";
import { EmptyState } from "@/components/EmptyState";
import { searchNotes } from "@/lib/search";
import { sortNotes, sortProjects } from "@/db/schema";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";
import { NotesColumn } from "./NotesColumn";
import { tagTone } from "./TagChip";

type SortMode = "updated" | "created" | "title";

// ─── NEW: sort labels are translation keys so they follow the interface language. ───
const SORT_LABELS: Record<SortMode, TranslationKey> = {
    updated: "notes.sortUpdated",
    created: "notes.sortCreated",
    title: "notes.sortTitle"
};

export function NotesPage({ initialTag }: { initialTag?: string }) {
    const { notes, projects, ready } = useStore();
    const workflows = useWorkflows();
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const [projectFilter, setProjectFilter] = useState<string>("all");
    const [tagFilter, setTagFilter] = useState<string>(initialTag ?? "");
    const [sortMode, setSortMode] = useState<SortMode>("updated");
    const [flagged, setFlagged] = useState<"none" | "pinned" | "favorite">("none");

    const activeProjects = useMemo(() => sortProjects(projects.filter((project) => !project.archived)), [projects]);
    // ─── NEW: archived notes live on the Archive page, not in this list. ───
    const liveNotes = useMemo(() => notes.filter((note) => !note.archived), [notes]);
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();
        liveNotes.forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }, [liveNotes]);

    const filtered = useMemo(() => {
        let rows = query.trim() ? searchNotes(liveNotes, projects, query) : liveNotes;
        if (projectFilter !== "all") {
            rows = rows.filter((note) => (projectFilter === "none" ? note.projectId === null : note.projectId === projectFilter));
        }
        if (tagFilter) {
            rows = rows.filter((note) => note.tags.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase()));
        }
        if (flagged === "pinned") rows = rows.filter((note) => note.pinned);
        if (flagged === "favorite") rows = rows.filter((note) => note.favorite);
        const sorted = sortNotes(rows);
        if (sortMode === "updated") {
            return [...sorted].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
        }
        if (sortMode === "created") {
            return [...sorted].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
        }
        return [...sorted].sort(
            (a, b) =>
                Number(b.pinned) - Number(a.pinned) ||
                (a.title || "Untitled note").localeCompare(b.title || "Untitled note")
        );
    }, [liveNotes, projects, query, projectFilter, tagFilter, flagged, sortMode]);

    const filtersActive = Boolean(query.trim() || projectFilter !== "all" || tagFilter || flagged !== "none");

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    return (
        <div className="page notes-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">{t("notes.title")}</h1>
                    <p className="page-subtitle">
                        {liveNotes.length === 1
                            ? t("notes.savedLocally", { count: liveNotes.length })
                            : t("notes.savedLocallyPlural", { count: liveNotes.length })}
                    </p>
                </div>
                <div className="page-header-actions">
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => {
                            setFlagged((current) => (current === "pinned" ? "none" : "pinned"));
                        }}
                        aria-pressed={flagged === "pinned"}
                    >
                        <Pin size={13} strokeWidth={1.8} aria-hidden="true" />
                        {t("notes.pinned")}
                    </button>
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => {
                            setFlagged((current) => (current === "favorite" ? "none" : "favorite"));
                        }}
                        aria-pressed={flagged === "favorite"}
                    >
                        <Star size={13} strokeWidth={1.8} aria-hidden="true" />
                        {t("notes.favorites")}
                    </button>
                    <button
                        type="button"
                        className="button button-primary button-small"
                        data-tour="new-note"
                        onClick={() => {
                            void workflows.createNote({ open: true });
                        }}
                    >
                        <Plus size={14} strokeWidth={2} aria-hidden="true" />
                        {t("common.newNote")}
                    </button>
                </div>
            </header>

            <div className="filter-bar">
                <label className="search-field">
                    <Search size={14} strokeWidth={1.9} aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        placeholder={t("notes.searchPlaceholder")}
                        aria-label={t("notes.search")}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                <label className="inline-field">
                    <span>
                        <Filter size={12} strokeWidth={1.9} aria-hidden="true" /> {t("common.project")}
                    </span>
                    <select
                        className="text-input select-input select-inline"
                        value={projectFilter}
                        onChange={(event) => setProjectFilter(event.target.value)}
                    >
                        <option value="all">{t("notes.allProjects")}</option>
                        <option value="none">{t("common.unassigned")}</option>
                        {activeProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="inline-field">
                    <span>
                        <ArrowDownAZ size={12} strokeWidth={1.9} aria-hidden="true" /> {t("notes.sort")}
                    </span>
                    <select
                        className="text-input select-input select-inline"
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as SortMode)}
                    >
                        {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                            <option key={mode} value={mode}>
                                {t(SORT_LABELS[mode])}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {tagCounts.length > 0 ? (
                <div className="tag-filter-row" role="group" aria-label={t("notes.filterByTag")} data-tour="tag-filters">
                    {tagFilter ? (
                        <button type="button" className="tag-clear" onClick={() => setTagFilter("")}>
                            <X size={11} strokeWidth={2.4} aria-hidden="true" />
                            {t("notes.clearTag")}
                        </button>
                    ) : null}
                    {tagCounts.map(([tag, count]) => (
                        <span key={tag} className={tagFilter === tag ? "tag-filter is-active" : "tag-filter"}>
                            <button
                                type="button"
                                className={`tag-chip tag-${tagTone(tag)}`}
                                aria-pressed={tagFilter === tag}
                                aria-label={t("notes.filterTagged", { tag, count })}
                                onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                            >
                                <span aria-hidden="true">{tag}</span>
                                <span className="tag-count" aria-hidden="true">
                                    {count}
                                </span>
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}

            {filtered.length === 0 ? (
                <div className="panel">
                    <EmptyState
                        icon={FileText}
                        title={liveNotes.length === 0 ? t("notes.emptyTitle") : t("notes.emptyNoMatchTitle")}
                        description={
                            liveNotes.length === 0
                                ? t("notes.emptyText")
                                : t("notes.emptyNoMatchText")
                        }
                        action={
                            liveNotes.length === 0 ? (
                                <button
                                    type="button"
                                    className="button button-primary button-small"
                                    onClick={() => {
                                        void workflows.createNote({ open: true });
                                    }}
                                >
                                    {t("common.newNote")}
                                </button>
                            ) : filtersActive ? (
                                <button
                                    type="button"
                                    className="button button-ghost button-small"
                                    onClick={() => {
                                        setQuery("");
                                        setProjectFilter("all");
                                        setTagFilter("");
                                        setFlagged("none");
                                    }}
                                >
                                    {t("common.clearFilters")}
                                </button>
                            ) : null
                        }
                    />
                </div>
            ) : (
                <NotesColumn
                    notes={filtered}
                    projects={projects}
                    limit={filtered.length}
                    className="is-full"
                    handlers={{
                        onOpen: (note) => workflows.openNote(note.id),
                        onDelete: workflows.requestDeleteNote,
                        onArchive: (note) => workflows.archiveNote(note, true),
                        onToggleFlag: workflows.toggleNoteFlag,
                        onMove: workflows.moveNote,
                        onSelectTag: (tag) => setTagFilter(tag),
                        onReorder: (ids) => {
                            void workflows.reorderNotes(ids);
                        }
                    }}
                />
            )}
        </div>
    );
}
