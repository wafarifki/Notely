export type NavTarget =
    | { name: "home" }
    | { name: "notes" }
    | { name: "tasks" }
    | { name: "project"; id: string }
    | { name: "activity" }
    | { name: "settings" }
    | { name: "support" }
    | { name: "whats-new" }
    | { name: "privacy" };
