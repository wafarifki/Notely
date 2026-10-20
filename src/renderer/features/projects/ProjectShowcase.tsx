import type { ProjectRecord } from "@/db/schema";
import { useI18n } from "@/i18n";
import { FolderCard } from "./FolderCard";

export function ProjectShowcase({
    projects,
    onOpen
}: {
    projects: ProjectRecord[];
    onOpen: (project: ProjectRecord) => void;
}) {
    const { t } = useI18n();
    const lifted = projects[2];

    if (!lifted) {
        return null;
    }

    return (
        <div className="projects-grid is-showcase">
            {projects.slice(0, 6).map((project, index) => (
                <div
                    key={project.id}
                    className={`project-grid-cell${index === 2 ? " is-showcase-target" : ""}`}
                    style={index === 2 ? { zIndex: 3 } : undefined}
                >
                    {index === 2 ? (
                        <>
                            <div className="drop-slot drop-slot-showcase" aria-hidden="true" />
                            <FolderCard project={project} elevated dragMode slotLabel={t("project.dropHere")} />
                        </>
                    ) : (
                        <FolderCard
                            project={project}
                            ariaPosInSet={index + 1}
                            ariaSetSize={projects.length}
                            onOpen={() => onOpen(project)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
