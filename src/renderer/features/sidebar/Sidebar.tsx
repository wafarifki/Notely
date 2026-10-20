import { useEffect, useRef, useState } from "react";
import {
    Archive,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    Clock3,
    FileText,
    FolderClosed,
    Github,
    Home,
    Loader2,
    Plus,
    Search
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { sortProjects, type SettingsRecord } from "@/db/schema";
import type { Route } from "@/app/router";
import type { NavTarget } from "@/app/navigation";
import { useStore } from "@/app/store";
import { useI18n } from "@/i18n";

export function Sidebar({
    route,
    settings,
    navigate,
    onOpenSearch,
    onNewProject,
    onToggleProjects,
    onExpandProjects
}: {
    route: Route;
    settings: SettingsRecord;
    navigate: (target: NavTarget) => void;
    onOpenSearch: () => void;
    onNewProject: () => void;
    onToggleProjects: () => void;
    // ─── NEW: opens the section without toggling (used when a project is added). ───
    onExpandProjects: () => void;
}) {
    const { projects } = useStore();
    const { t } = useI18n();
    const activeProjects = sortProjects(projects.filter((project) => !project.archived));
    const isHome = route.name === "home";
    const isNotes = route.name === "notes" || route.name === "note";
    const isTasks = route.name === "tasks";
    const activeProjectId = route.name === "project" ? route.id : null;

    // ─── NEW: a collapsed Projects section used to swallow newly created
    // projects, so the item existed but the dropdown looked unchanged. Whenever
    // the project count grows we open the section outright (never toggle, which
    // could race with the store and collapse it again). ───
    const previousCount = useRef(activeProjects.length);
    useEffect(() => {
        const grew = activeProjects.length > previousCount.current;
        previousCount.current = activeProjects.length;
        if (grew && !settings.projectsExpanded) {
            onExpandProjects();
        }
    }, [activeProjects.length, settings.projectsExpanded, onExpandProjects]);

    // ─── NEW: feedback for the moment the dropdown is opening.
    // The list is already in memory, so opening normally paints within a frame
    // and a spinner would only flash. We start in the "opening" state and clear
    // it on the frame that runs AFTER the opened rows have painted. On a fast
    // machine that is one frame (never seen); when the browser is busy it stays
    // visible until the rows are genuinely on screen. ───
    const [opening, setOpening] = useState(false);
    const frameRef = useRef(0);

    function handleToggleProjects() {
        // settings still holds the previous value during this click.
        setOpening(!settings.projectsExpanded);
        onToggleProjects();
    }

    useEffect(() => {
        if (!opening) return;
        // Two frames: the first draws the open list, the second confirms paint.
        const first = requestAnimationFrame(() => {
            frameRef.current = requestAnimationFrame(() => setOpening(false));
        });
        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(frameRef.current);
        };
    }, [opening]);

    const showLoading = opening;

    return (
        <>
            <div className="sidebar-profile" data-tour="profile">
                <Avatar
                    id={settings.avatarId}
                    name={settings.displayName}
                    size={34}
                    image={settings.avatarImage ?? null}
                />
                <div className="profile-text">
                    <span className="profile-email" title={settings.email}>
                        {settings.email}
                    </span>
                    <span className="profile-name">{settings.displayName}</span>
                </div>
            </div>

            <button
                type="button"
                className="new-project-button"
                onClick={onNewProject}
                data-tour="new-project"
            >
                <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
                {t("nav.newProject")}
            </button>

            <nav className="sidebar-nav" aria-label={t("a11y.navWorkspace")}>
                <button
                    type="button"
                    className="sidebar-row"
                    onClick={onOpenSearch}
                    aria-label={t("a11y.searchAll")}
                    data-tour="search"
                >
                    <Search size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("nav.search")}</span>
                    <span className="shortcut-hint" aria-hidden="true">
                        Ctrl K
                    </span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={isHome ? "page" : undefined}
                    data-tour="nav-home"
                    onClick={() => navigate({ name: "home" })}
                >
                    <Home size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("nav.home")}</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={isNotes ? "page" : undefined}
                    data-tour="nav-notes"
                    onClick={() => navigate({ name: "notes" })}
                >
                    <FileText size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("nav.notes")}</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={isTasks ? "page" : undefined}
                    data-tour="nav-tasks"
                    onClick={() => navigate({ name: "tasks" })}
                >
                    <CheckCircle2 size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("nav.tasks")}</span>
                </button>
            </nav>

            <div className="sidebar-divider" role="presentation" />

            <button
                type="button"
                className="sidebar-projects-header"
                onClick={handleToggleProjects}
                aria-expanded={settings.projectsExpanded}
                aria-controls="sidebar-projects"
            >
                <FolderClosed size={15} strokeWidth={1.7} aria-hidden="true" />
                <span className="row-label">{t("nav.projects")}</span>
                {/* ─── NEW: a spinner replaces the chevron while the list opens,
                so the click always has visible feedback. ─── */}
                {showLoading ? (
                    <Loader2
                        className="sidebar-projects-spinner"
                        size={14}
                        strokeWidth={2}
                        aria-hidden="true"
                    />
                ) : (
                    <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                        style={{
                            transform: settings.projectsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 160ms var(--ease-calm)"
                        }}
                    />
                )}
            </button>

            {/* ─── OLD CODE (kept for reference) ───
            {settings.projectsExpanded ? (
                <div className="sidebar-project-list" id="sidebar-projects" role="list">
                    {activeProjects.map((project) => ( ... ))}
                    {activeProjects.length === 0 ? (
                        <p className="sidebar-empty-hint">{t("sidebar.noProjects")}</p>
                    ) : null}
                </div>
            ) : null}
            ─── NEW: the whole list used to disappear when the section was
            collapsed, and the "No projects yet" hint lived inside that same
            block. A collapsed section therefore looked exactly like "my new
            project never appeared". The list now always renders (collapsed
            just hides it visually) and always offers a way to add a project. ─── */}
            <div
                className="sidebar-project-list"
                id="sidebar-projects"
                role="list"
                aria-busy={showLoading}
                hidden={!settings.projectsExpanded}
            >
                {/* ─── NEW: placeholder rows for a genuinely slow render. They
                REPLACE the list (never stack on top of it) and stay non-interactive. ─── */}
                {showLoading ? (
                    <div className="sidebar-project-skeleton" aria-hidden="true">
                        <span className="sidebar-skeleton-row" />
                        <span className="sidebar-skeleton-row" />
                        <span className="sidebar-skeleton-row" />
                    </div>
                ) : (
                    <>
                        {activeProjects.map((project) => (
                            <a
                                key={project.id}
                                href={`#/projects/${project.id}`}
                                role="listitem"
                                className="sidebar-project"
                                aria-current={activeProjectId === project.id ? "page" : undefined}
                                title={project.name}
                                onClick={(event) => {
                                    event.preventDefault();
                                    navigate({ name: "project", id: project.id });
                                }}
                            >
                                <span className="project-dot" data-color={project.color} aria-hidden="true" />
                                <span className="row-label">{project.name}</span>
                            </a>
                        ))}
                        {activeProjects.length === 0 ? (
                            <p className="sidebar-empty-hint">{t("sidebar.noProjects")}</p>
                        ) : null}
                        {/* ─── NEW: add a project straight from the dropdown. ─── */}
                        <button
                            type="button"
                            className="sidebar-add-project"
                            onClick={onNewProject}
                            data-tour="sidebar-add-project"
                        >
                            <Plus size={13} strokeWidth={2.1} aria-hidden="true" />
                            {t("sidebar.addProject")}
                        </button>
                    </>
                )}
            </div>

            <div className="sidebar-footer">
                {/* ─── OLD CODE (kept for reference) ───
                <button
                    type="button"
                    className="sidebar-row"
                    onClick={onStartTour}
                    data-tour="tour-button"
                >
                    <Compass size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("sidebar.takeTour")}</span>
                </button>
                ─── NEW: the tour now starts automatically on the very first launch,
                so the permanent sidebar entry was removed. It can still be replayed
                from Settings → Appearance → Product tour. ─── */}
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "archive" ? "page" : undefined}
                    onClick={() => navigate({ name: "archive" })}
                >
                    <Archive size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("nav.archive")}</span>
                </button>
                {/* ─── NEW: Recent Activity sits directly below Archive. The page
                itself was only reachable by URL before. ─── */}
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "activity" ? "page" : undefined}
                    onClick={() => navigate({ name: "activity" })}
                >
                    <Clock3 size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("nav.activity")}</span>
                </button>
                {/* ─── OLD CODE (kept for reference) ───
                <button className="sidebar-row" onClick={() => navigate({ name: "support" })}>
                    <LifeBuoy … /> {t("sidebar.support")}
                </button>
                <button className="sidebar-row" onClick={() => navigate({ name: "whats-new" })}>
                    <Gift … /> {t("sidebar.whatsNew")}
                </button>
                <button className="sidebar-row" onClick={() => navigate({ name: "privacy" })}>
                    <ShieldCheck … /> {t("sidebar.privacy")}
                </button>
                ─── NEW: Support, What's new and Privacy Policy moved to
                Settings → About & legal, just above the About card. ─── */}
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "settings" ? "page" : undefined}
                    onClick={() => navigate({ name: "settings" })}
                >
                    <BookOpen size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">{t("sidebar.settings")}</span>
                </button>
                <div className="sidebar-credits">
                    <span>
                        {t("sidebar.madeBy")} <strong>Faceindo Developer Team</strong>
                    </span>
                    <a
                        href="https://github.com/wafarifki/Notely"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="sidebar-credit-link"
                    >
                        <Github size={12} strokeWidth={1.8} aria-hidden="true" />
                        wafarifki/Notely
                    </a>
                </div>
            </div>
        </>
    );
}
