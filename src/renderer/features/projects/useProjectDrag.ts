import { useCallback, useRef, useState } from "react";

interface ProjectDragState {
    /** Id of the project being dragged, or null when idle. */
    id: string | null;
    /** Grid slot index the dragged card would land on. */
    target: number | null;
}

const EMPTY: ProjectDragState = { id: null, target: null };

export function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
        return items;
    }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

export function useProjectDrag(orderedIds: string[], onCommit: (orderedIds: string[]) => void) {
    const [state, setState] = useState<ProjectDragState>(EMPTY);
    const stateRef = useRef(state);
    stateRef.current = state;

    const start = useCallback((id: string) => {
        setState({ id, target: orderedIds.indexOf(id) });
    }, [orderedIds]);

    const hover = useCallback((index: number) => {
        setState((current) => (current.id === null || current.target === index ? current : { ...current, target: index }));
    }, []);

    const finish = useCallback(
        (commit: boolean) => {
            const current = stateRef.current;
            setState(EMPTY);
            if (!commit || current.id === null || current.target === null) return;
            const from = orderedIds.indexOf(current.id);
            if (from === -1 || from === current.target) return;
            onCommit(moveItem(orderedIds, from, current.target).map(String));
        },
        [orderedIds, onCommit]
    );

    const validateOnly = useCallback(
        (id: string) => (orderedIds.includes(id) ? id : null),
        [orderedIds]
    );

    return {
        draggingId: state.id,
        targetIndex: state.target,
        start,
        hover,
        finish,
        validateOnly
    };
}
