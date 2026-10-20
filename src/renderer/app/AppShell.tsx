import { useEffect, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Copy, Menu, Minus, Square, X } from "lucide-react";
import { Sidebar } from "@/features/sidebar/Sidebar";
import type { Route } from "./router";
import { getDesktopBridge, isElectronRuntime } from "@/platform/desktop";
import type { SettingsRecord } from "@/db/schema";

function WindowControls() {
    const [maximized, setMaximized] = useState(false);
    const bridge = getDesktopBridge();

    useEffect(() => {
        if (!bridge) return;
        bridge.isMaximized().then(setMaximized).catch(() => undefined);
        return bridge.onMaximizeChange(setMaximized);
    }, [bridge]);

    if (!bridge) return null;

    return (
        <div className="window-controls" role="toolbar" aria-label="Window controls">
            <button type="button" onClick={() => bridge.minimize()} aria-label="Minimize">
                <Minus size={14} strokeWidth={1.8} />
            </button>
            <button
                type="button"
                onClick={() => bridge.toggleMaximize().then(setMaximized).catch(() => undefined)}
                aria-label={maximized ? "Restore down" : "Maximize"}
            >
                {maximized ? <Copy size={12} strokeWidth={1.8} /> : <Square size={11} strokeWidth={1.8} />}
            </button>
            <button type="button" data-action="close" onClick={() => bridge.close()} aria-label="Close">
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
    children
}: {
    route: Route;
    navigate: (target: Route) => void;
    settings: SettingsRecord;
    onOpenSearch: () => void;
    onNewProject: () => void;
    onToggleSidebar: () => void;
    onToggleProjects: () => void;
    children: ReactNode;
}) {
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

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
        <div className={electron ? "electron-runtime app-canvas" : "app-canvas"}>
            {electron ? <div className="drag-strip" aria-hidden="true" /> : null}
            <WindowControls />
            <div className="app-panel" data-sidebar={collapsed ? "collapsed" : "open"}>
                {isMobile && !collapsed ? (
                    <button
                        type="button"
                        className="app-scrim"
                        aria-label="Close navigation"
                        onClick={onToggleSidebar}
                    />
                ) : null}
                <aside className="app-sidebar" aria-label="Primary navigation">
                    <Sidebar
                        route={route}
                        settings={settings}
                        navigate={navigate}
                        onOpenSearch={onOpenSearch}
                        onNewProject={onNewProject}
                        onToggleProjects={onToggleProjects}
                    />
                    <button
                        type="button"
                        className="sidebar-collapse-handle"
                        onClick={onToggleSidebar}
                        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
                        title={collapsed ? "Show sidebar" : "Hide sidebar"}
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
                            aria-label="Open navigation"
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
