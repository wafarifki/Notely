export interface DesktopBridge {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    platform: string;
    onMaximizeChange(listener: (maximized: boolean) => void): () => void;
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
