import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import { resetAndSeed } from "./ui-helpers";

async function startApp(hash: string) {
    const db = await resetAndSeed();
    window.location.hash = hash;
    const user = userEvent.setup();
    render(<App />);
    return { db, user };
}

describe("notes flows", () => {
    it("searches notes by tag from the notes page and opens a note", async () => {
        const { user } = await startApp("#/notes");
        await screen.findByRole("heading", { name: "Notes" });

        const tagButton = await screen.findByRole("button", { name: "Filter notes tagged Design challenges (1)" });
        await user.click(tagButton);

        const headings = await screen.findAllByRole("heading", { name: "Design challenges" });
        expect(headings).toHaveLength(1);
    });

    it("edits a note, autosaves it and stores the new content", async () => {
        const { db, user } = await startApp("#/notes");
        await screen.findByRole("heading", { name: "Notes" });

        const noteLink = await screen.findByRole("button", { name: "Open note: Design challenges" });
        await user.click(noteLink);

        const title = (await screen.findByLabelText("Note title")) as HTMLInputElement;
        expect(title.value).toBe("Design challenges");
        await user.clear(title);
        await user.type(title, "Design challenges 2026");

        await waitFor(
            async () => {
                const notes = await db.notes.toArray();
                expect(notes.some((note) => note.title === "Design challenges 2026")).toBe(true);
            },
            { timeout: 4000 }
        );
    });

    // ─── NEW regression: the editor used to open empty because its internal
    // "last value" ref was pre-seeded with the incoming content. ───
    it("shows the stored body when a note with HTML content is reopened", async () => {
        const { db, user } = await startApp("#/notes");
        await screen.findByRole("heading", { name: "Notes" });

        const notes = await db.notes.toArray();
        const target = notes.find((note) => note.title === "Design challenges")!;
        await db.notes.update(target.id, { content: "<p>Saved rich text body</p>" });

        const noteLink = await screen.findByRole("button", { name: "Open note: Design challenges" });
        await user.click(noteLink);

        const editor = (await screen.findByRole("textbox", { name: "Note content" })) as HTMLElement;
        await waitFor(() => {
            expect(editor.textContent).toContain("Saved rich text body");
        });
    });
});

describe("tasks flows", () => {
    it("filters the task list and keeps favorite toggles", async () => {
        const { db, user } = await startApp("#/tasks");
        await screen.findByRole("heading", { name: "Tasks" });

        await user.click(screen.getByRole("tab", { name: "Completed" }));
        expect(await screen.findByText("Collect feedback")).toBeInTheDocument();
        expect(screen.queryByText("Work on the plan")).not.toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: "All" }));
        const star = await screen.findByRole("button", { name: "Add Analyse test results to favorites" });
        await user.click(star);
        await waitFor(async () => {
            const task = (await db.tasks.toArray()).find((row) => row.title === "Analyse test results");
            expect(task?.favorite).toBe(true);
        });
    });
});
