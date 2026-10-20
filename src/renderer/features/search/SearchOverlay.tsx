import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, FileText, FolderClosed, Search, X } from "lucide-react";
import { useStore } from "@/app/store";
import { formatDueLabel } from "@/lib/dates";
import { searchAll, type SearchResults } from "@/lib/search";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

interface ResultItem {
    key: string;
    group: "Projects" | "Notes" | "Tasks";
    title: string;
    meta: string;
    color?: string;
    onOpen: () => void;
}

// ─── NEW: group headings are translated while the internal keys stay stable. ───
const GROUP_KEYS: Record<ResultItem["group"], TranslationKey> = {
    Projects: "search.groupProjects",
    Notes: "search.groupNotes",
    Tasks: "search.groupTasks"
};

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { projects, notes, tasks } = useStore();
    const workflows = useWorkflows();
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        setQuery("");
        setActiveIndex(0);
        const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
        return () => window.clearTimeout(timer);
    }, [open]);

    const results: SearchResults = useMemo(
        () =>
            searchAll(
                query,
                notes.filter((note) => !note.archived),
                tasks.filter((task) => !task.archived),
                projects
            ),
        [query, notes, tasks, projects]
    );

    const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);

    const items: ResultItem[] = useMemo(() => {
        const projectItems = results.projects.slice(0, 6).map<ResultItem>((project) => ({
            key: `project-${project.id}`,
            group: "Projects",
            title: project.name,
            meta: project.description || t("search.metaProject"),
            color: project.color,
            onOpen: () => workflows.go({ name: "project", id: project.id })
        }));
        const noteItems = results.notes.slice(0, 8).map<ResultItem>((note) => ({
            key: `note-${note.id}`,
            group: "Notes",
            title: note.title || t("common.untitledNote"),
            meta: note.projectId ? projectNames.get(note.projectId) ?? t("search.metaNote") : t("common.unassigned"),
            onOpen: () => workflows.openNote(note.id)
        }));
        const taskItems = results.tasks.slice(0, 8).map<ResultItem>((task) => ({
            key: `task-${task.id}`,
            group: "Tasks",
            title: task.title,
            meta: task.completed ? t("common.completed") : formatDueLabel(task.dueAt, new Date(), t),
            onOpen: () => workflows.openTaskDialog(task)
        }));
        return [...projectItems, ...noteItems, ...taskItems];
    }, [results, projectNames, workflows, t]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(items.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter" && items[activeIndex]) {
                event.preventDefault();
                items[activeIndex].onOpen();
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [open, items, activeIndex, onClose]);

    useEffect(() => {
        const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
        active?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    if (!open) return null;

    let cursor = -1;
    const groups: { name: ResultItem["group"]; items: ResultItem[] }[] = ["Projects", "Notes", "Tasks"].map(
        (name) => ({ name: name as ResultItem["group"], items: items.filter((item) => item.group === name) })
    );

    const iconFor = (group: ResultItem["group"]) =>
        group === "Projects" ? FolderClosed : group === "Notes" ? FileText : CheckCircle2;

    return createPortal(
        <div
            className="search-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="search-dialog" role="dialog" aria-modal="true" aria-label={t("search.dialogLabel")}>
                <div className="search-input-row">
                    <Search size={16} strokeWidth={1.9} aria-hidden="true" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        placeholder={t("search.placeholder")}
                        aria-label={t("search.placeholder")}
                        aria-controls="search-results"
                        aria-activedescendant={items[activeIndex] ? `search-item-${items[activeIndex].key}` : undefined}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <button type="button" className="icon-button" onClick={onClose} aria-label={t("search.close")}>
                        <X size={15} strokeWidth={1.9} />
                    </button>
                </div>
                <div className="search-results scroll-area" id="search-results" ref={listRef} role="listbox">
                    {query.trim() === "" ? (
                        <p className="search-hint">{t("search.hint")}</p>
                    ) : items.length === 0 ? (
                        <p className="search-hint">{t("search.noMatches", { query: query.trim() })}</p>
                    ) : (
                        groups.map((group) =>
                            group.items.length === 0 ? null : (
                                <div key={group.name} className="search-group" role="group" aria-label={t(GROUP_KEYS[group.name])}>
                                    <div className="search-group-label">{t(GROUP_KEYS[group.name])}</div>
                                    {group.items.map((item) => {
                                        cursor += 1;
                                        const index = cursor;
                                        const Icon = iconFor(item.group);
                                        return (
                                            <button
                                                key={item.key}
                                                id={`search-item-${item.key}`}
                                                data-index={index}
                                                type="button"
                                                role="option"
                                                aria-selected={index === activeIndex}
                                                className={`search-result${index === activeIndex ? " is-active" : ""}`}
                                                onMouseEnter={() => setActiveIndex(index)}
                                                onClick={() => {
                                                    item.onOpen();
                                                    onClose();
                                                }}
                                            >
                                                <span className="search-result-icon" aria-hidden="true">
                                                    <Icon size={14} strokeWidth={1.8} />
                                                </span>
                                                <span className="search-result-text">
                                                    <span className="search-result-title">{item.title}</span>
                                                    <span className="search-result-meta">{item.meta}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )
                        )
                    )}
                </div>
                <div className="search-footer">
                    <span>
                        {results.total === 1
                            ? t("search.resultOne")
                            : t("search.resultsMany", { count: results.total })}
                    </span>
                    <span>
                        <kbd>Esc</kbd> {t("search.escToClose")}
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
}
