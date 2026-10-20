import { useEffect, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Copy, Menu, Minus, Square, X } from "lucide-react";
import { Sidebar } from "@/features/sidebar/Sidebar";
import type { Route } from "./router";
import { getDesktopBridge, isElectronRuntime } from "@/platform/desktop";
import type { SettingsRecord } from "@/db/schema";
import { useI18n } from "@/i18n";

function WindowControls() {
    const [maximized, setMaximized] = useState(false);
    const bridge = getDesktopBridge();

    useEffect(() => {
        if (!bridge) return;
        bridge.isMaximized().then(setMaximized).catch(() => undefined);
        return bridge.onMaximizeChange(setMaximized);
    }, [bridge]);

    if (!bridge) return null;
    const { t } = useI18n();

    return (
        <div className="window-controls" role="toolbar" aria-label={t("a11y.windowControls")}>
            <button type="button" onClick={() => bridge.minimize()} aria-label={t("a11y.minimize")}>
                <Minus size={14} strokeWidth={1.8} />
            </button>
            <button
                type="button"
                onClick={() => bridge.toggleMaximize().then(setMaximized).catch(() => undefined)}
                aria-label={maximized ? t("a11y.restore") : t("a11y.maximize")}
            >
                {maximized ? <Copy size={12} strokeWidth={1.8} /> : <Square size={11} strokeWidth={1.8} />}
            </button>
            <button type="button" data-action="close" onClick={() => bridge.close()} aria-label={t("a11y.closeWindow")}>
                <X size={14} strokeWidth={1.8} />
            </button>
        </div>
    );
}

export function AppShell({
    route,
    navigate,
    settings,
    onOpenSearch,
    onNewProject,
    onToggleSidebar,
    onToggleProjects,
    onExpandProjects,
    children
}: {
    route: Route;
    navigate: (target: Route) => void;
    settings: SettingsRecord;
    onOpenSearch: () => void;
    onNewProject: () => void;
    onToggleSidebar: () => void;
    onToggleProjects: () => void;
    onExpandProjects: () => void;
    children: ReactNode;
}) {
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const { t } = useI18n();

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const collapsed = viewportWidth < 800 ? true : settings.sidebarCollapsed;
    const electron = isElectronRuntime();
    const [isMobile, setIsMobile] = useState(() =>
        typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 799px)").matches : false
    );

    useEffect(() => {
        const query = window.matchMedia("(max-width: 799px)");
        const listener = (event: MediaQueryListEvent) => setIsMobile(event.matches);
        query.addEventListener("change", listener);
        return () => query.removeEventListener("change", listener);
    }, []);

    return (
        <div
            className={[
                electron ? "electron-runtime" : "",
                "app-canvas",
                settings.animatedBackground ? "has-ambient" : ""
            ]
                .filter(Boolean)
                .join(" ")}
            data-theme-applied={settings.theme}
        >
            {electron ? <div className="drag-strip" aria-hidden="true" /> : null}
            <WindowControls />
            <div className="app-panel" data-sidebar={collapsed ? "collapsed" : "open"}>
                {isMobile && !collapsed ? (
                    <button
                        type="button"
                        className="app-scrim"
                        aria-label={t("a11y.closeNavigation")}
                        onClick={onToggleSidebar}
                    />
                ) : null}
                <aside className="app-sidebar" aria-label={t("a11y.primaryNavigation")}>
                    <Sidebar
                        route={route}
                        settings={settings}
                        navigate={navigate}
                        onOpenSearch={onOpenSearch}
                        onNewProject={onNewProject}
                        onToggleProjects={onToggleProjects}
                        onExpandProjects={onExpandProjects}
                    />
                    <button
                        type="button"
                        className="sidebar-collapse-handle"
                        onClick={onToggleSidebar}
                        aria-label={collapsed ? t("sidebar.showSidebar") : t("sidebar.hideSidebar")}
                        title={collapsed ? t("sidebar.showSidebar") : t("sidebar.hideSidebar")}
                    >
                        {collapsed ? (
                            <ChevronsRight size={16} strokeWidth={1.9} />
                        ) : (
                            <ChevronsLeft size={16} strokeWidth={1.9} />
                        )}
                    </button>
                </aside>
                <div className="app-main">
                    <div className="mobile-topbar">
                        <button
                            type="button"
                            className="mobile-menu-button"
                            onClick={onToggleSidebar}
                            aria-label={t("sidebar.showNav")}
                        >
                            <Menu size={18} strokeWidth={1.8} />
                        </button>
                        <span className="mobile-topbar-title">Notely</span>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
