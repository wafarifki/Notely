export function createId(prefix: string): string {
    const cryptoApi = globalThis.crypto;
    const random =
        cryptoApi && typeof cryptoApi.randomUUID === "function"
            ? cryptoApi.randomUUID().replace(/-/g, "").slice(0, 16)
            : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${random}`;
}

export const ACTORS = [
    { id: "nick-woods", name: "Nick Woods" },
    { id: "maya-hayes", name: "Maya Hayes" },
    { id: "cassie-melendez", name: "Cassie Melendez" },
    { id: "ronny-schultz", name: "Ronny Schultz" },
    { id: "amanda-finnegan", name: "Amanda Finnegan" },
    { id: "rob-houghton", name: "Rob Houghton" }
] as const;
