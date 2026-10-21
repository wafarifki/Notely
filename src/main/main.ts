import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, screen, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
    CREATE_FILE_CHANNEL,
    LAUNCH_CHANNEL,
    LAUNCH_RUN_CHANNEL,
    normalizeActionFlag,
    type LaunchIntent
} from "./channels";
import { parseLaunchArgs, readDocument } from "./documents";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5391";
const isDevelopment = !app.isPackaged;

// ─── NEW: Windows shell integration ──────────────────────────────────────────
// Explorer can start Notely with `--app-task`, `--app-note` or `--app-txt`
// (context menu) and with a `.txt` / `.md` path (file association). Those
// arguments arrive here before the window exists, so the intent is queued and
// handed to the renderer once it asks for it.
let pendingIntent: LaunchIntent | null = null;
let rendererReady = false;

function queueIntent(intent: LaunchIntent | null) {
    if (!intent) return;
    if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(LAUNCH_CHANNEL, intent);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        return;
    }
    // Keep only the newest intent: a second dropped file replaces an unhandled one.
    pendingIntent = intent;
}

/**
 * `--app-txt` needs no renderer involvement: the shortcut just drops an empty
 * `newfile.txt` next to the user and reveals it. Kept in the main process so it
 * also works before the window has finished loading.
 *
 * `targetPath` is the folder Explorer passed as `%V`. Explorer does not
 * reliably set the working directory to the clicked folder, so relying on
 * `process.cwd()` alone put `newfile.txt` in unpredictable places. Passing the
 * path explicitly makes the file land where the user right-clicked.
 */
function createNewTxtFile(targetPath?: string): string | null {
    const target = newTextFileTarget(targetPath);
    if (!target) return null;
    if (!fs.existsSync(target)) fs.writeFileSync(target, "", "utf8");
    shell.showItemInFolder(target);
    return target;
}

/**
 * Where should `newfile.txt` go?
 *
 * ─── OLD CODE (kept for reference) ───
 * const candidates = [process.cwd(), app.getPath("documents"), app.getPath("desktop")];
 * Explorer's launched process inherits an unrelated working directory, so
 * `process.cwd()` was a guess. The `%V` path from the registry command is the
 * folder (or desktop) the user actually right-clicked.
 *
 * ─── NEW: prefer the explicit path, then fall back to Documents/Desktop. ───
 */
function newTextFileTarget(targetPath?: string): string | null {
    const candidates: string[] = [];
    if (targetPath) {
        try {
            const resolved = path.resolve(targetPath);
            // `%V` can be a folder (Directory\Background) or a file (`*`,
            // Directory). Use the directory in both cases.
            const stats = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
            candidates.push(stats && stats.isDirectory() ? resolved : path.dirname(resolved));
        } catch {
            // Ignore an unusable path and fall through to the defaults.
        }
    }
    candidates.push(process.cwd(), app.getPath("documents"), app.getPath("desktop"));

    for (const directory of candidates) {
        try {
            if (!directory || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) continue;
            let name = "newfile.txt";
            let counter = 1;
            // Never overwrite an existing file; `newfile (1).txt` and so on.
            while (fs.existsSync(path.join(directory, name))) {
                name = `newfile (${counter}).txt`;
                counter += 1;
            }
            return path.join(directory, name);
        } catch {
            continue;
        }
    }
    return null;
}

/** The `%V` path passed by the context-menu command, if any. */
function folderArgumentFrom(argv: readonly string[]): string | undefined {
    return argv.find((value) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith("-") || trimmed.includes("%")) return false;
        return path.isAbsolute(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed);
    });
}

app.setName("Notely");

let mainWindow: BrowserWindow | null = null;

interface WindowPreferences {
    maximized: boolean;
    bounds: Electron.Rectangle;
}

const DEFAULT_PREFERENCES: WindowPreferences = {
    maximized: true,
    bounds: { x: 0, y: 0, width: 1280, height: 800 }
};

function preferencesFile(): string {
    return path.join(app.getPath("userData"), "window-state.json");
}

function readPreferences(): WindowPreferences {
    try {
        const raw = JSON.parse(fs.readFileSync(preferencesFile(), "utf8")) as Partial<WindowPreferences>;
        return {
            maximized: typeof raw.maximized === "boolean" ? raw.maximized : DEFAULT_PREFERENCES.maximized,
            bounds: raw.bounds ?? DEFAULT_PREFERENCES.bounds
        };
    } catch {
        return { ...DEFAULT_PREFERENCES };
    }
}

const preferences = fs.existsSync(preferencesFile()) ? readPreferences() : { ...DEFAULT_PREFERENCES };

function backgroundColor(): string {
    return "#ddd2ef";
}

function isOnVisibleDisplay(bounds: Electron.Rectangle): boolean {
    return screen.getAllDisplays().some(({ workArea }) => {
        const overlapX = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
        const overlapY = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);
        return overlapX > 160 && overlapY > 120;
    });
}

function initialBounds() {
    const saved = preferences.bounds;
    if (saved.width >= 760 && saved.height >= 560 && isOnVisibleDisplay(saved)) {
        return saved;
    }
    const { workArea } = screen.getPrimaryDisplay();
    const width = Math.min(1504, Math.max(980, workArea.width - 64));
    const height = Math.min(1128, Math.max(680, workArea.height - 72));
    return {
        x: Math.round(workArea.x + (workArea.width - width) / 2),
        y: Math.round(workArea.y + (workArea.height - height) / 2),
        width,
        height
    };
}

function rememberWindowState(window: BrowserWindow) {
    if (window.isDestroyed()) return;
    const state = {
        maximized: window.isMaximized(),
        bounds: window.isMaximized() ? window.getNormalBounds() : window.getBounds()
    };
    preferences.bounds = state.bounds;
    preferences.maximized = state.maximized;
    fs.writeFileSync(preferencesFile(), JSON.stringify(preferences, null, 4));
}

function sendMaximizeState(window: BrowserWindow) {
    if (window.isDestroyed()) return;
    window.webContents.send("window:maximized-changed", window.isMaximized());
}

function createWindow() {
    const bounds = initialBounds();
    mainWindow = new BrowserWindow({
        ...bounds,
        minWidth: 760,
        minHeight: 560,
        show: false,
        backgroundColor: backgroundColor(),
        title: "Notely",
        icon: path.join(app.getAppPath(), "assets", "icon.ico"),
        autoHideMenuBar: true,
        // ─── OLD CODE (kept for reference) ───
        // titleBarStyle: "hidden",
        // titleBarOverlay: false,
        // ...
        // titleBarStyle: process.platform === "win32" ? "hiddenInset" : "hidden",
        // `hiddenInset` is a macOS-only value. On Windows it is not supported and
        // produced a frameless window: the renderer's own control cluster was
        // still there, but the window had no frame and could not be resized, so
        // the panel appeared to stop following the window. Going back to
        // `hidden` + `thickFrame` gives Windows a resizable 1px-border window
        // with the title bar hidden — the renderer draws the buttons.
        // ─── NEW: keep the native resize border on Windows (`thickFrame`) while
        // hiding the title bar, and let the renderer paint its own controls. ───
        titleBarStyle: "hidden",
        titleBarOverlay: false,
        thickFrame: true,
        resizable: true,
        maximizable: true,
        minimizable: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            spellcheck: true
        }
    });

    mainWindow.setMenuBarVisibility(false);

    if (preferences.maximized) {
        mainWindow.maximize();
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });

    let saveTimer: NodeJS.Timeout | null = null;
    const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            if (mainWindow) rememberWindowState(mainWindow);
        }, 400);
    };
    mainWindow.on("resize", scheduleSave);
    mainWindow.on("move", scheduleSave);
    mainWindow.on("maximize", scheduleSave);
    mainWindow.on("unmaximize", scheduleSave);
    mainWindow.on("close", () => {
        if (saveTimer) clearTimeout(saveTimer);
        if (mainWindow) rememberWindowState(mainWindow);
    });

    mainWindow.on("maximize", () => mainWindow && sendMaximizeState(mainWindow));
    mainWindow.on("unmaximize", () => mainWindow && sendMaximizeState(mainWindow));
    mainWindow.on("closed", () => {
        mainWindow = null;
        // ─── NEW: the next window re-registers and drains the intent queue. ───
        rendererReady = false;
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://")) {
            void shell.openExternal(url);
        }
        return { action: "deny" };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
        const allowed = isDevelopment ? url.startsWith(DEV_SERVER_URL) : url.startsWith("file://");
        if (!allowed) {
            event.preventDefault();
        }
    });

    mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });

    if (isDevelopment) {
        void mainWindow.loadURL(DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
        void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }
}

function registerWindowControls() {
    const windowFrom = (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender);

    ipcMain.handle("window:minimize", (event) => {
        windowFrom(event)?.minimize();
    });
    ipcMain.handle("window:toggle-maximize", (event) => {
        const window = windowFrom(event);
        if (!window) return false;
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
        return window.isMaximized();
    });
    ipcMain.handle("window:close", (event) => {
        windowFrom(event)?.close();
    });
    ipcMain.handle("window:is-maximized", (event) => windowFrom(event)?.isMaximized() ?? false);
}

/**
 * Shell-integration IPC.
 *
 * The renderer pulls the pending intent on start-up (a file dropped on the app
 * icon arrives before React exists) and subscribes for later ones (a second
 * file opened while Notely is already running).
 */
function registerLaunchBridge() {
    ipcMain.handle(LAUNCH_RUN_CHANNEL, (_event, action: unknown): boolean => {
        if (typeof action !== "string") return false;
        const verb = normalizeActionFlag(action);
        if (verb === "txt") {
            // `--app-txt` is a main-process action: it writes the file and
            // reveals it, no renderer round-trip needed.
            createNewTxtFile();
            return true;
        }
        if (verb === "task") {
            queueIntent({ kind: "task" });
            return true;
        }
        // ─── NEW: "Create New Notes" opens a blank note. `notes` is accepted
        // as an alias so an older shortcut keeps working after a rename. ───
        if (verb === "note" || verb === "notes") {
            queueIntent({ kind: "note" });
            return true;
        }
        return false;
    });

    ipcMain.handle(CREATE_FILE_CHANNEL, (): string | null => createNewTxtFile());

    // ─── NEW: default-app helpers ───
    // Windows 10/11 keeps the real default in
    // `Explorer\FileExts\.txt\UserChoice`, whose value is hash-signed by
    // Explorer. No installer can write it, so the only supported route is to
    // hand the user the Windows UI and let them pick Notely once. These
    // handlers open exactly the right page instead of making them hunt for it.
    ipcMain.handle("app:open-default-apps", async (_event, extension: unknown) => {
        const ext = typeof extension === "string" && /^\.[a-z0-9]+$/i.test(extension) ? extension : ".txt";
        // `ms-settings:defaultapps` exists on Windows 10 1903+ and 11.
        await shell.openExternal(`ms-settings:defaultapps?registeredAppUser=Notely&extension=${ext}`);
        return true;
    });

    // "Open with" for a real file: lets the user pick Notely and tick
    // "Always use this app", which is what actually writes UserChoice.
    ipcMain.handle("app:open-with", async (_event, filePath: unknown) => {
        if (typeof filePath !== "string") return false;
        try {
            // `rundll32 shell32.dll,OpenAs_RunDLL <file>` is the documented way
            // to raise the native "Open with" chooser.
            const { spawn } = await import("node:child_process");
            spawn("rundll32.exe", ["shell32.dll,OpenAs_RunDLL", filePath], {
                detached: true,
                stdio: "ignore"
            }).unref();
            return true;
        } catch {
            return false;
        }
    });

    // The renderer is mounted and ready for intents; drain the queue.
    ipcMain.handle(`${LAUNCH_CHANNEL}:ready`, (): LaunchIntent | null => {
        rendererReady = true;
        const intent = pendingIntent;
        pendingIntent = null;
        return intent;
    });

    // ─── NEW: opening a `.txt` / `.md` through the file association. ───
    // The renderer stores notes in IndexedDB, which the main process cannot
    // reach, so it replies with the parsed document and lets the renderer
    // decide whether to reuse an existing note or import a fresh one.
    ipcMain.handle("app:read-document", (_event, filePath: unknown) => {
        if (typeof filePath !== "string") return null;
        // Imported lazily so the parse/convert helpers stay out of startup.
        return readDocument(filePath);
    });

    // ─── NEW: exporting a note to disk ───
    // The renderer builds the file text (it owns the note HTML); the main
    // process owns the save dialog and the write, because only it can touch
    // the filesystem. `canceled` is a normal outcome, not an error.
    ipcMain.handle("app:save-export", async (event, payload: unknown) => {
        const data = payload as { fileName?: unknown; body?: unknown } | null;
        if (!data || typeof data.fileName !== "string" || typeof data.body !== "string") {
            return { ok: false, canceled: false, reason: "invalid-payload" };
        }
        const window = BrowserWindow.fromWebContents(event.sender);
        const extension = path.extname(data.fileName).replace(".", "").toLowerCase() || "txt";
        const { canceled, filePath } = await dialog.showSaveDialog(window ?? undefined!, {
            title: "Export note",
            defaultPath: path.join(app.getPath("documents"), data.fileName),
            filters: [
                extension === "md"
                    ? { name: "Markdown", extensions: ["md"] }
                    : { name: "Text", extensions: ["txt"] }
            ]
        });
        if (canceled || !filePath) return { ok: false, canceled: true };

        try {
            // ─── NEW: a leading BOM makes Windows Notepad read the file as
            // UTF-8 instead of ANSI, which otherwise mangles accents and
            // emoji in exported notes. Markdown editors tolerate it. ───
            const withBom = `\uFEFF${data.body}`;
            fs.writeFileSync(filePath, withBom, "utf8");
            // Offer the result straight away, the same as the TXT shortcut.
            shell.showItemInFolder(filePath);
            return { ok: true, canceled: false, filePath };
        } catch (error) {
            return { ok: false, canceled: false, reason: error instanceof Error ? error.message : "write-failed" };
        }
    });

    // ─── NEW: clipboard writes ───
    // Copying rich text needs Electron's clipboard, which is not available in
    // the sandboxed renderer. The renderer sends both representations so the
    // paste target can choose: formatted apps take the HTML, code editors take
    // the plain text.
    ipcMain.handle("app:copy-note", (_event, payload: unknown) => {
        const data = payload as { text?: unknown; html?: unknown } | null;
        if (!data || typeof data.text !== "string") return false;
        if (typeof data.html === "string" && data.html) {
            clipboard.write({ text: data.text, html: data.html });
        } else {
            clipboard.writeText(data.text);
        }
        return true;
    });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    // ─── NEW: a second launch (file association, context menu) forwards its
    // command line to the running instance instead of opening another window. ───
    app.on("second-instance", (_event, argv) => {
        // ─── OLD CODE (kept for reference) ───
        // queueIntent(parseLaunchArgs(argv));
        // `parseLaunchArgs` only understands the renderer-facing verbs. A
        // second `--app-txt` click was therefore parsed as `null` and did
        // nothing at all — the file was never created. `--app-txt` is handled
        // entirely in the main process (no renderer involved), and must be
        // checked before the generic intent queue.
        const normalized = argv.map((value) => value.trim().toLowerCase());
        const wantsTxt = normalized.some((value) => /^--app[\s-]txt$/.test(value));
        if (wantsTxt) {
            // `%V` from the context menu tells us which folder to write into.
            createNewTxtFile(folderArgumentFrom(argv));
            if (!mainWindow) return;
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            return;
        }
        queueIntent(parseLaunchArgs(argv));
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    nativeTheme.themeSource = "light";
    Menu.setApplicationMenu(null);
    registerWindowControls();
    registerLaunchBridge();

    app.whenReady().then(() => {
        app.setAppUserModelId("com.notely.desktop");

        // ─── OLD CODE (kept for reference) ───
        // createWindow();
        // ─── NEW: remember the first-launch command line before the window
        // opens, then honour a direct `--app-txt` request by writing the file
        // and quitting (Explorer's "New > Text Document" equivalent). ───
        const argv = process.argv.slice(1);
        // ─── NEW: `--app-txt` is checked FIRST. `parseLaunchArgs` returns null
        // for it (it is not a renderer intent), and the old `else if` meant it
        // only ran when nothing else matched — which held, but the argument
        // search below must still see `%V`, so the order matters. ───
        if (argv.some((value) => /^--app[\s-]txt$/i.test(value))) {
            // `%V` from the context menu tells us which folder to write into.
            createNewTxtFile(folderArgumentFrom(argv));
            app.quit();
            return;
        }

        const launch = parseLaunchArgs(argv);
        if (launch) {
            queueIntent(launch);
        }

        createWindow();

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
}
