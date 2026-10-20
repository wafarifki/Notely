import type {
    ActivityRecord,
    NoteRecord,
    ProjectRecord,
    SettingsRecord,
    TaskRecord
} from "./schema";

export const SEED_VERSION = 1;
export const SEED_INSTANT = "2021-04-27T03:52:00.000Z";
const HOUR = 60 * 60 * 1000;

export interface SeedData {
    projects: ProjectRecord[];
    notes: NoteRecord[];
    tasks: TaskRecord[];
    activity: ActivityRecord[];
    settings: SettingsRecord;
}

export const DEMO_PROFILE: SettingsRecord = {
    id: "app",
    displayName: "Nick Woods",
    email: "nick.woods@gmail.com",
    avatarId: "nick-woods",
    projectsExpanded: true,
    sidebarCollapsed: false,
    demoDragState: true,
    completedTasksVisible: true,
    showWeekends: true
};

export function buildSeedData(anchor: Date = new Date()): SeedData {
    const anchorTime = anchor.getTime();
    const createdAt = SEED_INSTANT;
    const project = (id: string, name: string, color: ProjectRecord["color"], order: number): ProjectRecord => ({
        id,
        name,
        description: "",
        color,
        order,
        archived: false,
        createdAt,
        updatedAt: createdAt
    });

    const projects: ProjectRecord[] = [
        project("seed-project-workshop", "Workshop planning and ideas", "purple", 0),
        project("seed-project-design", "Design exploration", "green", 1),
        project("seed-project-feedback", "Users’ feedback", "orange", 2),
        project(
            "seed-project-plans",
            "Plans for future and other directions, ideas for improvement",
            "yellow",
            3
        ),
        project("seed-project-testing", "Testing results", "pink", 4),
        project("seed-project-design-cyan", "Design exploration", "cyan", 5)
    ];

    const note = (
        id: string,
        title: string,
        content: string,
        projectId: string | null,
        tags: string[],
        order: number
    ): NoteRecord => ({
        id,
        title,
        content,
        projectId,
        tags,
        pinned: false,
        favorite: false,
        order,
        createdAt,
        updatedAt: createdAt
    });

    const notes: NoteRecord[] = [
        note(
            "seed-note-plans",
            "Plans for future and other directions, what needs to be done",
            "A Design Direction unifies everyone and adds meaning to web design. It’s a combination of art and strategy that helps shape a product. When everyone works from the same direction, decisions become faster and the small details start to reinforce each other instead of pulling apart.",
            "seed-project-plans",
            [],
            0
        ),
        note(
            "seed-note-design-challenges",
            "Design challenges",
            "What Is A Design Challenge? Design challenges are exercises or competitions that designers can do to boost creativity, create positive habits, and learn new methods for solving design problems.\n\nWe will run a short workshop every Friday and collect the strongest outcomes in one shared board.",
            "seed-project-workshop",
            ["Workshops", "Design challenges", "Work in progress"],
            1
        ),
        note(
            "seed-note-user-interview",
            "How to conduct a user interview that could improve your product?",
            "You cannot understand good design if you do not understand people; design is made for people. User interviews are a tool that can help you get this understanding.\n\nPrepare five open questions, listen more than you speak, and write down direct quotes before your memory rewrites them.",
            "seed-project-feedback",
            ["Needs to be done", "Questions"],
            2
        ),
        note(
            "seed-note-dribbble",
            "Note B - Dribbble strategy",
            "Shot cadence: three uploads per week, one behind-the-scenes process shot and one finished exploration. Keep the captions short and point people to the workshop notes.",
            "seed-project-design",
            ["Marketing"],
            3
        ),
        note(
            "seed-note-meeting",
            "Meeting planning",
            "Agenda for the next planning meeting: recap of the design exploration, review the workshop questions, and agree on the testing schedule for the new onboarding flow.",
            "seed-project-workshop",
            ["Meetings"],
            4
        )
    ];

    const task = (
        id: string,
        title: string,
        dueOffsetHours: number,
        completed: boolean,
        favorite: boolean,
        projectId: string | null,
        order: number
    ): TaskRecord => ({
        id,
        title,
        notes: "",
        projectId,
        completed,
        favorite,
        priority: favorite ? "high" : "medium",
        dueAt: new Date(anchorTime + dueOffsetHours * HOUR).toISOString(),
        order,
        createdAt,
        updatedAt: createdAt,
        completedAt: completed ? createdAt : null
    });

    const tasks: TaskRecord[] = [
        task("seed-task-plan", "Work on the plan", 3, false, true, "seed-project-plans", 0),
        task("seed-task-feedback", "Collect feedback", -1, true, false, "seed-project-workshop", 1),
        task("seed-task-results", "Analyse test results", 16, false, false, "seed-project-testing", 2),
        task("seed-task-conclusion", "Conclusion", 24, false, false, "seed-project-testing", 3),
        task("seed-task-ideas", "Sort all ideas", 24, false, false, "seed-project-plans", 4)
    ];

    const activity = (
        id: string,
        actorId: ActivityRecord["actorId"],
        actorName: string,
        kind: ActivityRecord["kind"],
        entityType: ActivityRecord["entityType"],
        entityId: string,
        title: string,
        projectId: string | null,
        minutesAgo: number
    ): ActivityRecord => ({
        id,
        actorId,
        actorName,
        kind,
        entityType,
        entityId,
        title,
        projectId,
        createdAt: new Date(Date.UTC(2021, 3, 27, 9, 40) - minutesAgo * 60 * 1000).toISOString()
    });

    const activityRecords: ActivityRecord[] = [
        activity(
            "seed-activity-1",
            "maya-hayes",
            "Maya Hayes",
            "updated",
            "note",
            "seed-note-design-challenges",
            "Design challenges",
            "seed-project-workshop",
            12
        ),
        activity(
            "seed-activity-2",
            "cassie-melendez",
            "Cassie Melendez",
            "updated",
            "note",
            "seed-note-dribbble",
            "Note B - Dribbble strategy",
            "seed-project-design",
            24
        ),
        activity(
            "seed-activity-3",
            "ronny-schultz",
            "Ronny Schultz",
            "updated",
            "note",
            "seed-note-dribbble",
            "Note B - Dribbble strategy",
            "seed-project-design",
            40
        ),
        activity(
            "seed-activity-4",
            "amanda-finnegan",
            "Amanda Finnegan",
            "updated",
            "note",
            "seed-note-meeting",
            "Meeting planning",
            "seed-project-workshop",
            58
        ),
        activity(
            "seed-activity-5",
            "rob-houghton",
            "Rob Houghton",
            "updated",
            "note",
            "seed-note-plans",
            "Plans for future and other directions, what needs to be done",
            "seed-project-plans",
            75
        )
    ];

    return {
        projects,
        notes,
        tasks,
        activity: activityRecords,
        settings: { ...DEMO_PROFILE }
    };
}
