import { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen, shell } from "electron";
import path from "node:path";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5391";
const isDevelopment = !app.isPackaged;

app.setName("Notely");

let mainWindow: BrowserWindow | null = null;

function backgroundColor(): string {
    return "#ddd2ef";
}

function initialBounds() {
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
        titleBarStyle: "hidden",
        titleBarOverlay: false,
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

    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });

    mainWindow.on("maximize", () => mainWindow && sendMaximizeState(mainWindow));
    mainWindow.on("unmaximize", () => mainWindow && sendMaximizeState(mainWindow));
    mainWindow.on("closed", () => {
        mainWindow = null;
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

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    nativeTheme.themeSource = "light";
    Menu.setApplicationMenu(null);
    registerWindowControls();

    app.whenReady().then(() => {
        app.setAppUserModelId("com.notely.desktop");
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
