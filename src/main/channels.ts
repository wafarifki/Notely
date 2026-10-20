/**
 * IPC channel names shared by the main process and the preload bridge.
 *
 * Kept in its own module (and free of Electron imports) so preload can pull the
 * values in without dragging main-process code into the sandboxed bundle.
 */

/** Main → renderer: a shell command or an opened file is waiting to be handled. */
export const LAUNCH_CHANNEL = "app:launch-intent";

/** Renderer asks the main process to handle a shell command. */
export const LAUNCH_RUN_CHANNEL = "app:launch-run";

/** Renderer asks the main process to write a new .txt file and reveal it. */
export const CREATE_FILE_CHANNEL = "app:create-file";

export type LaunchAction = "task" | "note" | "notes" | "txt";

/**
 * The renderer re-uses the "app:" prefix for launch commands so a single
 * argument parser handles both `notely.exe --app-task` and the registry command
 * line that Windows builds from electron-builder's `fileAssociations` entry.
 */
export type LaunchIntent = { kind: "task" } | { kind: "note" } | { kind: "file"; path: string };

/**
 * Registry verbs use spaces (`--app-task`), while the Electron CLI uses dashes.
 * Normalising here means both spellings work and nobody has to remember which
 * one the installer wrote.
 */
export function normalizeActionFlag(raw: string): string {
    return raw.replace(/-/g, " ").trim().toLowerCase();
}
