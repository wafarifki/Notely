import { contextBridge, ipcRenderer } from "electron";
// ─── NEW: the channel names live in a dependency-free module so both the main
// process and this sandboxed preload import the same strings. ───
import { CREATE_FILE_CHANNEL, LAUNCH_CHANNEL, LAUNCH_RUN_CHANNEL } from "../main/channels";

/**
 * Shape of a `.txt` / `.md` file converted by the main process. Declared here so
 * the sandboxed preload stays self-contained (it cannot import renderer types).
 */
interface ImportedDocumentPayload {
    title: string;
    content: string;
    sourcePath: string;
    kind: "markdown" | "text";
}

type LaunchIntentPayload = { kind: "task" } | { kind: "note" } | { kind: "file"; path: string };

const desktopBridge = {
    minimize: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize") as Promise<boolean>,
    close: () => ipcRenderer.invoke("window:close") as Promise<void>,
    isMaximized: () => ipcRenderer.invoke("window:is-maximized") as Promise<boolean>,
    platform: process.platform,
    onMaximizeChange: (listener: (maximized: boolean) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => listener(maximized);
        ipcRenderer.on("window:maximized-changed", handler);
        return () => {
            ipcRenderer.removeListener("window:maximized-changed", handler);
        };
    },

    // ─── NEW: Windows shell integration (context menu + file association) ───

    /** Drain an intent queued before the renderer mounted (a file opened on launch). */
    takePendingIntent: () => ipcRenderer.invoke(`${LAUNCH_CHANNEL}:ready`) as Promise<LaunchIntentPayload | null>,

    /** Intents that arrive while Notely is already running. */
    onLaunchIntent: (listener: (intent: LaunchIntentPayload) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, intent: LaunchIntentPayload) => listener(intent);
        ipcRenderer.on(LAUNCH_CHANNEL, handler);
        return () => {
            ipcRenderer.removeListener(LAUNCH_CHANNEL, handler);
        };
    },

    /** Ask the main process to run a shell verb: `task`, `note` or `txt`. */
    runLaunchAction: (action: string) => ipcRenderer.invoke(LAUNCH_RUN_CHANNEL, action) as Promise<boolean>,

    /** Create `newfile.txt` in the folder Explorer launched us from and reveal it. */
    createTextFile: () => ipcRenderer.invoke(CREATE_FILE_CHANNEL) as Promise<string | null>,

    /** Read a `.txt` / `.md` file and convert it to editor-ready HTML. */
    readDocument: (filePath: string) =>
        ipcRenderer.invoke("app:read-document", filePath) as Promise<ImportedDocumentPayload | null>,

    // ─── NEW: default-app helpers. Windows hash-signs the per-user default, so
    // an installer cannot claim `.txt` outright; these open the Windows UI that
    // can. ───
    /** Open Settings > Default apps for an extension (`".txt"`). */
    openDefaultApps: (extension: string) => ipcRenderer.invoke("app:open-default-apps", extension) as Promise<boolean>,

    /** Raise the native "Open with" chooser for a file. */
    openWith: (filePath: string) => ipcRenderer.invoke("app:open-with", filePath) as Promise<boolean>
};

contextBridge.exposeInMainWorld("notesDesktop", desktopBridge);
