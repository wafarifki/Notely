/**
 * A `.txt` / `.md` file converted to editor-ready HTML by the main process.
 * `sourcePath` is remembered on the note so re-opening the same file updates
 * the existing note instead of creating a duplicate.
 */
export interface ImportedDocument {
    title: string;
    content: string;
    sourcePath: string;
    kind: "markdown" | "text";
}

/**
 * A shell command from Windows.
 * - `task` / `note`: the Explorer context-menu shortcuts
 * - `file`: the user opened a `.txt` / `.md` through Notely
 */
export type LaunchIntent =
    | { kind: "task" }
    | { kind: "note" }
    | { kind: "file"; path: string };

export interface DesktopBridge {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    platform: string;
    onMaximizeChange(listener: (maximized: boolean) => void): () => void;
    // ─── NEW: Windows shell integration ───
    takePendingIntent(): Promise<LaunchIntent | null>;
    onLaunchIntent(listener: (intent: LaunchIntent) => void): () => void;
    runLaunchAction(action: string): Promise<boolean>;
    createTextFile(): Promise<string | null>;
    readDocument(filePath: string): Promise<ImportedDocument | null>;
    // ─── NEW: Windows hash-signs the per-user default app, so claiming `.txt`
    // needs the user to confirm once in Settings or "Open with". ───
    openDefaultApps(extension: string): Promise<boolean>;
    openWith(filePath: string): Promise<boolean>;
}

declare global {
    interface Window {
        notesDesktop?: DesktopBridge;
    }
}

export function getDesktopBridge(): DesktopBridge | null {
    return window.notesDesktop ?? null;
}

export function isElectronRuntime(): boolean {
    return Boolean(window.notesDesktop);
}
