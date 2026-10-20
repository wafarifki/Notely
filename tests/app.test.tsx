import { describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import { NotesDatabase, getDatabase } from "@/db/database";

async function resetSharedDatabase() {
    const db: NotesDatabase = getDatabase();
    await db.delete();
    await db.open();
}

describe("dashboard app", () => {
    it("renders the seeded dashboard and persists task checkbox changes", async () => {
        await resetSharedDatabase();
        window.location.hash = "#/";
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByText(/Welcome back, Nick!/)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "My projects" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "My tasks" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "My notes" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
        expect(await screen.findByText("Work on the plan")).toBeInTheDocument();
        expect(screen.getByText("Collect feedback")).toBeInTheDocument();
        expect(screen.getAllByText("Design exploration").length).toBeGreaterThan(0);
        expect(screen.getByText("Maya Hayes")).toBeInTheDocument();

        const checkbox = screen.getByLabelText('Mark "Work on the plan" as done');
        await user.click(checkbox);

        await waitFor(async () => {
            const task = (await getDatabase().tasks.toArray()).find((row) => row.title === "Work on the plan");
            expect(task?.completed).toBe(true);
        });
    });

    it("opens search results and keeps pin/favorite toggles saved", async () => {
        await resetSharedDatabase();
        window.location.hash = "#/";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByText(/Welcome back, Nick!/);

        await user.keyboard("{Control>}k{/Control}");
        const searchInput = await screen.findByLabelText("Search projects, notes and tasks");
        await user.type(searchInput, "dribbble");
        const results = await screen.findByRole("listbox");
        expect(within(results).getByText("Note B - Dribbble strategy")).toBeInTheDocument();
    });
});
