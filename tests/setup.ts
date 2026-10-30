import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
    cleanup();
});

if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, "crypto", {
        value: {
            ...globalThis.crypto,
            randomUUID: () => {
                const hex = () => Math.floor(Math.random() * 16).toString(16);
                const groups = [8, 4, 4, 4, 12];
                return groups.map((size) => Array.from({ length: size }, hex).join("")).join("-");
            }
        },
        configurable: true
    });
}

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
    Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub });
}

const matchMediaStub = (query: string): MediaQueryList =>
    ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    }) as unknown as MediaQueryList;

Object.defineProperty(window, "matchMedia", { value: matchMediaStub, configurable: true, writable: true });

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
}
