import {
    BookOpen,
    CheckCircle2,
    ChevronDown,
    FileText,
    FolderClosed,
    Gift,
    Home,
    LifeBuoy,
    Plus,
    Search,
    ShieldCheck
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { sortProjects, type SettingsRecord } from "@/db/schema";
import type { Route } from "@/app/router";
import type { NavTarget } from "@/app/navigation";
import { useStore } from "@/app/store";

export function Sidebar({
    route,
    settings,
    navigate,
    onOpenSearch,
    onNewProject,
    onToggleProjects
}: {
    route: Route;
    settings: SettingsRecord;
    navigate: (target: NavTarget) => void;
    onOpenSearch: () => void;
    onNewProject: () => void;
    onToggleProjects: () => void;
}) {
    const { projects } = useStore();
    const activeProjects = sortProjects(projects.filter((project) => !project.archived));
    const isHome = route.name === "home";
    const isNotes = route.name === "notes" || route.name === "note";
    const isTasks = route.name === "tasks";
    const activeProjectId = route.name === "project" ? route.id : null;

    return (
        <>
            <div className="sidebar-profile">
                <Avatar id={settings.avatarId} name={settings.displayName} size={34} />
                <div className="profile-text">
                    <span className="profile-email" title={settings.email}>
                        {settings.email}
                    </span>
                    <span className="profile-name">{settings.displayName}</span>
                </div>
            </div>

            <button type="button" className="new-project-button" onClick={onNewProject}>
                <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
                New Project
            </button>

            <nav className="sidebar-nav" aria-label="Workspace">
                <button
                    type="button"
                    className="sidebar-row"
                    onClick={onOpenSearch}
                    aria-label="Search notes, tasks and projects"
                >
                    <Search size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Search</span>
                    <span className="shortcut-hint" aria-hidden="true">
                        Ctrl K
                    </span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={isHome ? "page" : undefined}
                    onClick={() => navigate({ name: "home" })}
                >
                    <Home size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Home</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={isNotes ? "page" : undefined}
                    onClick={() => navigate({ name: "notes" })}
                >
                    <FileText size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Notes</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={isTasks ? "page" : undefined}
                    onClick={() => navigate({ name: "tasks" })}
                >
                    <CheckCircle2 size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Tasks</span>
                </button>
            </nav>

            <div className="sidebar-divider" role="presentation" />

            <button
                type="button"
                className="sidebar-projects-header"
                onClick={onToggleProjects}
                aria-expanded={settings.projectsExpanded}
                aria-controls="sidebar-projects"
            >
                <FolderClosed size={15} strokeWidth={1.7} aria-hidden="true" />
                <span className="row-label">Projects</span>
                <ChevronDown
                    size={14}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    style={{
                        transform: settings.projectsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 160ms var(--ease-calm)"
                    }}
                />
            </button>

            {settings.projectsExpanded ? (
                <div className="sidebar-project-list" id="sidebar-projects" role="list">
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
                        <p className="sidebar-empty-hint">No projects yet</p>
                    ) : null}
                </div>
            ) : null}

            <div className="sidebar-footer">
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "support" ? "page" : undefined}
                    onClick={() => navigate({ name: "support" })}
                >
                    <LifeBuoy size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Support</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "whats-new" ? "page" : undefined}
                    onClick={() => navigate({ name: "whats-new" })}
                >
                    <Gift size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">What&apos;s new</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "privacy" ? "page" : undefined}
                    onClick={() => navigate({ name: "privacy" })}
                >
                    <ShieldCheck size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Privacy Policy</span>
                </button>
                <button
                    type="button"
                    className="sidebar-row"
                    aria-current={route.name === "settings" ? "page" : undefined}
                    onClick={() => navigate({ name: "settings" })}
                >
                    <BookOpen size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="row-label">Settings</span>
                </button>
            </div>
        </>
    );
}
