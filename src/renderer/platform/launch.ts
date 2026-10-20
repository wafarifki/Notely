import { useEffect, useRef } from "react";
import { getDesktopBridge, type LaunchIntent } from "./desktop";

/**
 * Subscribe to shell commands coming from Windows.
 *
 * Two delivery paths exist because the intent can arrive at any time:
 * - before React mounted (a `.md` opened from Explorer) — drained once via
 *   `takePendingIntent()`;
 * - while Notely is already running (a second file, or the context menu) —
 *   pushed through `onLaunchIntent`.
 *
 * `onIntent` is kept in a ref so callers do not have to memoise it and a new
 * callback identity never re-subscribes (which would replay handler timing).
 */
export function useLaunchIntent(onIntent: (intent: LaunchIntent) => void): void {
    const handlerRef = useRef(onIntent);
    handlerRef.current = onIntent;

    useEffect(() => {
        const bridge = getDesktopBridge();
        if (!bridge) return;

        // ─── OLD CODE (kept for reference) ───
        // let cancelled = false;
        // void bridge.takePendingIntent().then((intent) => {
        //     if (!cancelled && intent) handlerRef.current(intent);
        // });
        //
        // const off = bridge.onLaunchIntent((intent) => {
        //     if (!cancelled) handlerRef.current(intent);
        // });
        //
        // return () => {
        //     cancelled = true;
        //     off();
        // };
        //
        // ─── NEW: under React StrictMode (main.tsx renders inside <StrictMode>)
        // effects run mount → unmount → mount. The old code drained the queued
        // intent on the first run, then its cleanup flipped `cancelled` and threw
        // the result away; the second run asked again, got `null`, and an opened
        // `.txt` / `.md` silently did nothing. `consumePendingIntent()` caches the
        // promise so the destructive call happens exactly once. ───
        void consumePendingIntent().then((intent) => {
            if (intent) handlerRef.current(intent);
        });

        // Subscribing twice is harmless; only draining the queue is not.
        return bridge.onLaunchIntent((intent) => handlerRef.current(intent));
    }, []);
}

/** Cached promise so every consumer (and every remount) sees the same intent. */
let pendingIntentPromise: Promise<LaunchIntent | null> | null = null;

/**
 * Forget the cached intent. Exposed for tests (and for a future reload path)
 * so a fresh renderer can ask the main process again.
 */
export function resetPendingIntent(): void {
    pendingIntentPromise = null;
}

/**
 * Drain the main process's queued launch intent once.
 *
 * The promise is cached for the lifetime of the renderer: `takePendingIntent`
 * empties the queue on the main side, so a second call would return `null` and
 * the intent would be lost.
 */
export function consumePendingIntent(): Promise<LaunchIntent | null> {
    if (pendingIntentPromise) return pendingIntentPromise;
    const bridge = getDesktopBridge();
    if (!bridge) {
        pendingIntentPromise = Promise.resolve(null);
        return pendingIntentPromise;
    }
    pendingIntentPromise = bridge.takePendingIntent().catch(() => null);
    return pendingIntentPromise;
}
