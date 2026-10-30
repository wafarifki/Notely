import { describe, expect, it } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import { getDatabase } from "@/db/database";
import { createNotesService } from "@/data/service";
import { resetAndSeed, seedReturningUser } from "./ui-helpers";

describe("dashboard app", () => {
    it("persists task checkbox changes from the dashboard", async () => {
        await resetAndSeed();
        window.location.hash = "#/";
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByText(/Welcome back, Notely!/)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "My projects" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "My tasks" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "My notes" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
        expect(await screen.findByText("Work on the plan")).toBeInTheDocument();
        expect(screen.getByText("Collect feedback")).toBeInTheDocument();

        await user.click(screen.getByLabelText('Mark "Work on the plan" as done'));

        await waitFor(async () => {
            const task = (await getDatabase().tasks.toArray()).find((row) => row.title === "Work on the plan");
            expect(task?.completed).toBe(true);
        });
    });

    it("opens search and finds a note", async () => {
        await resetAndSeed();
        window.location.hash = "#/";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByText(/Welcome back, Notely!/);

        await user.keyboard("{Control>}k{/Control}");
        const searchInput = await screen.findByLabelText("Search projects, notes and tasks");
        await user.type(searchInput, "dribbble");
        const results = await screen.findByRole("listbox");
        expect(within(results).getByText("Note B - Dribbble strategy")).toBeInTheDocument();
    });

    it("shows the empty welcome state on a fresh install", async () => {
        await seedReturningUser();
        window.location.hash = "#/";
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Welcome to Notely" })).toBeInTheDocument();
        expect(screen.getByText("Your workspace is empty")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Create your first project/ })).toBeInTheDocument();
        expect(screen.queryByText("Work on the plan")).not.toBeInTheDocument();
    });

    it("switches to dark theme from settings", async () => {
        await seedReturningUser();
        window.location.hash = "#/settings";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: "Settings" });
        await user.click(screen.getByRole("radio", { name: /Dark/ }));

        await waitFor(() => {
            expect(document.documentElement.dataset.theme).toBe("dark");
        });
        expect((await getDatabase().settings.get("app"))?.theme).toBe("dark");
    });

    it("rejects an invalid custom color and keeps the current accent", async () => {
        await seedReturningUser();
        window.location.hash = "#/settings";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: "Settings" });
        const input = screen.getByLabelText("Accent hex value");
        await user.clear(input);
        await user.type(input, "#zzzzzz");
        await user.tab();

        expect(await screen.findByText(/Use a hex color/)).toBeInTheDocument();
        expect((await getDatabase().settings.get("app"))?.customAccent).toBeNull();
    });

    // ─── NEW: the accent hex field must mirror the preset that is applied, so
    // switching presets never leaves a stale colour behind in the picker. ───
    it("keeps the accent hex field in sync with the selected preset", async () => {
        await seedReturningUser();
        window.location.hash = "#/settings";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: "Settings" });
        await user.click(screen.getByRole("radio", { name: "Ocean" }));

        await waitFor(async () => {
            const stored = await getDatabase().settings.get("app");
            expect(stored?.accent).toBe("blue");
            expect(stored?.customAccent).toBeNull();
        });
        // The field follows the applied preset once the store settles.
        await waitFor(() => {
            expect((screen.getByLabelText("Accent hex value") as HTMLInputElement).value).toBe("#3f7fd6");
        });
    });

    // ─── NEW: a complete custom accent applies immediately while typing. ───
    it("applies a custom accent as soon as a full hex is typed", async () => {
        await seedReturningUser();
        window.location.hash = "#/settings";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: "Settings" });
        const input = screen.getByLabelText("Accent hex value");
        await user.clear(input);
        await user.type(input, "#ff8800");
        await user.tab();

        await waitFor(async () => {
            expect((await getDatabase().settings.get("app"))?.customAccent).toBe("#ff8800");
        });
    });

    // ─── NEW: language preference persists and translates the interface. ───
    it("switches the interface to Indonesian and remembers the choice", async () => {
        await seedReturningUser();
        window.location.hash = "#/settings";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: "Settings" });
        await user.click(screen.getByRole("radio", { name: "Bahasa Indonesia" }));

        expect(await screen.findByRole("heading", { name: "Pengaturan" })).toBeInTheDocument();
        expect(await screen.findByRole("heading", { name: "Tampilan" })).toBeInTheDocument();
        await waitFor(async () => {
            expect((await getDatabase().settings.get("app"))?.language).toBe("id");
        });
    });

    // ─── NEW regression: a collapsed Projects section used to hide the whole
    // list, so a freshly created project looked like it never appeared. ───
    it("shows a newly created project even when the projects section is collapsed", async () => {
        const db = await seedReturningUser();
        // Create the default profile first (the app does this on first run),
        // then persist the collapsed state through the same repository.
        const service = createNotesService(db);
        await service.initialize();
        await service.settings.update({ projectsExpanded: false });
        expect((await db.settings.get("app"))?.projectsExpanded).toBe(false);
        window.location.hash = "#/";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: /Welcome to Notely|Welcome back/ });

        const header = await screen.findByRole("button", { name: "Projects", expanded: false });
        await user.click(header);
        await waitFor(async () => {
            expect((await getDatabase().settings.get("app"))?.projectsExpanded).toBe(true);
        });
        await user.click(await screen.findByRole("button", { name: "Add new project" }));

        const nameInput = await screen.findByLabelText("Name");
        await user.type(nameInput, "Sidebar Project");
        await user.click(screen.getByRole("button", { name: "Create project" }));

        await waitFor(async () => {
            const rows = await getDatabase().projects.toArray();
            expect(rows.some((row) => row.name === "Sidebar Project")).toBe(true);
        });
        // The new project must be reachable from the sidebar dropdown.
        const sidebar = document.querySelector("#sidebar-projects");
        expect(sidebar?.textContent).toContain("Sidebar Project");
    });

    // ─── NEW: a collapsed section must not hide a newly created project. ───
    it("expands the projects dropdown automatically when a project is created", async () => {
        const db = await seedReturningUser();
        await db.settings.update("app", { projectsExpanded: false });
        window.location.hash = "#/";
        const user = userEvent.setup();
        render(<App />);

        await screen.findByRole("heading", { name: /Welcome to Notely|Welcome back/ });

        // Create a project while the section is collapsed.
        await user.click(screen.getByRole("button", { name: "Add new project" }));
        const nameInput = await screen.findByLabelText("Name");
        await user.type(nameInput, "Auto Expanded");
        await user.click(screen.getByRole("button", { name: "Create project" }));

        // The section opens itself and shows the new entry.
        await waitFor(async () => {
            expect((await getDatabase().settings.get("app"))?.projectsExpanded).toBe(true);
        });
        const list = document.querySelector("#sidebar-projects");
        expect(list?.hasAttribute("hidden")).toBe(false);
        expect(list?.textContent).toContain("Auto Expanded");
    });

    // ─── NEW: archived and deleted projects leave the sidebar dropdown. ───
    it("removes archived and deleted projects from the sidebar dropdown", async () => {
        const db = await seedReturningUser();
        const service = createNotesService(db);
        // These projects are created before the app mounts, so make sure the
        // dropdown is open regardless of what the previous test left behind.
        await service.settings.update({ projectsExpanded: true });
        const keep = await service.createProject({ name: "Keep Me", color: "purple" });
        const archive = await service.createProject({ name: "Archive Me", color: "green" });
        const remove = await service.createProject({ name: "Delete Me", color: "orange" });
        expect(keep).toBeTruthy();
        window.location.hash = "#/";
        render(<App />);

        // All three projects appear in the sidebar dropdown.
        await waitFor(() => {
            const list = document.querySelector("#sidebar-projects");
            expect(list?.textContent).toContain("Keep Me");
            expect(list?.textContent).toContain("Archive Me");
            expect(list?.textContent).toContain("Delete Me");
        });

        await act(async () => {
            await service.archiveProject(archive.id, true);
            await service.deleteProject(remove.id, "unassign");
        });

        await waitFor(() => {
            const list = document.querySelector("#sidebar-projects");
            expect(list?.textContent).not.toContain("Archive Me");
            expect(list?.textContent).not.toContain("Delete Me");
            expect(list?.textContent).toContain("Keep Me");
        });
    });

    // ─── NEW: the welcome tour only runs by itself on a brand-new install. ───
    it("starts the welcome tour automatically on the very first launch", async () => {
        const db = await seedReturningUser();
        // Reset the flag to emulate a first ever launch.
        await db.settings.update("app", { hasSeenTour: false });
        window.location.hash = "#/";
        render(<App />);

        // The tour mounts only after the stored settings row has loaded, which
        // needs a couple of ticks (Dexie read -> live query -> effect).
        await waitFor(
            () => {
                expect(document.querySelector(".tour-card")).not.toBeNull();
            },
            { timeout: 8000 }
        );
        // The flag flips immediately so quitting mid-tour never replays it.
        await waitFor(
            async () => {
                expect((await getDatabase().settings.get("app"))?.hasSeenTour).toBe(true);
            },
            { timeout: 8000 }
        );
    });

    it("does not auto-start the tour for a returning user", async () => {
        await seedReturningUser();
        window.location.hash = "#/";
        render(<App />);

        await screen.findByRole("heading", { name: /Welcome to Notely|Welcome back/ });
        expect(screen.queryByRole("dialog", { name: "Product tour" })).not.toBeInTheDocument();
    });

    // ─── NEW: the sidebar no longer offers a tour entry. ───
    it("no longer shows a tour button in the sidebar", async () => {
        await seedReturningUser();
        window.location.hash = "#/";
        render(<App />);

        await screen.findByRole("heading", { name: /Welcome to Notely|Welcome back/ });
        expect(screen.queryByRole("button", { name: "Take the tour" })).not.toBeInTheDocument();
    });
});
