import { contextBridge, ipcRenderer } from "electron";

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
    }
};

contextBridge.exposeInMainWorld("notesDesktop", desktopBridge);
