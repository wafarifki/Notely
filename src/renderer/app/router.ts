import { useCallback, useEffect, useState } from "react";

export type Route =
    | { name: "home" }
    | { name: "notes"; tag?: string }
    | { name: "note"; id: string }
    | { name: "tasks" }
    | { name: "project"; id: string }
    | { name: "activity" }
    | { name: "settings" }
    | { name: "support" }
    | { name: "whats-new" }
    | { name: "privacy" };

export const HOME_ROUTE: Route = { name: "home" };

function encodeSegment(value: string): string {
    return encodeURIComponent(value);
}

function decodeSegment(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function routeToHash(route: Route): string {
    switch (route.name) {
        case "home":
            return "#/";
        case "notes":
            return route.tag ? `#/notes?tag=${encodeSegment(route.tag)}` : "#/notes";
        case "note":
            return `#/notes/${encodeSegment(route.id)}`;
        case "tasks":
            return "#/tasks";
        case "project":
            return `#/projects/${encodeSegment(route.id)}`;
        case "activity":
            return "#/activity";
        case "settings":
            return "#/settings";
        case "support":
            return "#/support";
        case "whats-new":
            return "#/whats-new";
        case "privacy":
            return "#/privacy";
        default:
            return "#/";
    }
}

export function parseHash(hash: string): Route {
    const raw = hash.replace(/^#/, "");
    const [pathPart, queryPart = ""] = raw.split("?");
    const segments = pathPart.split("/").filter(Boolean).map(decodeSegment);
    const params = new URLSearchParams(queryPart);

    if (segments.length === 0) return HOME_ROUTE;
    switch (segments[0]) {
        case "notes":
            if (segments.length >= 2) return { name: "note", id: segments[1] };
            return params.get("tag") ? { name: "notes", tag: params.get("tag") ?? undefined } : { name: "notes" };
        case "tasks":
            return { name: "tasks" };
        case "projects":
            return segments[1] ? { name: "project", id: segments[1] } : { name: "notes" };
        case "activity":
            return { name: "activity" };
        case "settings":
            return { name: "settings" };
        case "support":
            return { name: "support" };
        case "whats-new":
            return { name: "whats-new" };
        case "privacy":
            return { name: "privacy" };
        default:
            return HOME_ROUTE;
    }
}

export function useHashRoute(): { route: Route; navigate: (route: Route) => void } {
    const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

    useEffect(() => {
        const handleChange = () => setRoute(parseHash(window.location.hash));
        window.addEventListener("hashchange", handleChange);
        return () => window.removeEventListener("hashchange", handleChange);
    }, []);

    const navigate = useCallback((next: Route) => {
        const hash = routeToHash(next);
        if (window.location.hash === hash) {
            setRoute(next);
            return;
        }
        window.location.hash = hash;
        setRoute(next);
    }, []);

    return { route, navigate };
}
