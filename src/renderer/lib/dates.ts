const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

export function ordinal(day: number): string {
    if (day % 100 >= 11 && day % 100 <= 13) return "th";
    switch (day % 10) {
        case 1:
            return "st";
        case 2:
            return "nd";
        case 3:
            return "rd";
        default:
            return "th";
    }
}

export function formatFullDate(iso: string): string {
    const date = new Date(iso);
    return `${date.getDate()}${ordinal(date.getDate())} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

export function formatShortDate(iso: string, now: Date = new Date()): string {
    const date = new Date(iso);
    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getDate()}${ordinal(date.getDate())} ${MONTHS[date.getMonth()].slice(0, 3)}`;
    }
    return formatFullDate(iso);
}

function startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function plural(value: number, singular: string, pluralForm = `${singular}s`): string {
    return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function formatDueLabel(dueAt: string | null, now: Date = new Date()): string {
    if (!dueAt) return "No due date";
    const due = new Date(dueAt).getTime();
    const diff = due - now.getTime();
    const beyondHours = Math.abs(diff) >= HOUR;
    const beyondFullDay = Math.abs(diff) >= DAY;

    if (diff < 0) {
        if (beyondFullDay) {
            const days = Math.floor(Math.abs(diff) / DAY);
            return `${plural(days, "day")} overdue`;
        }
        if (beyondHours) {
            const hours = Math.floor(Math.abs(diff) / HOUR);
            return `${plural(hours, "hour")} overdue`;
        }
        return `${Math.max(1, Math.floor(Math.abs(diff) / MINUTE))} min overdue`;
    }

    if (beyondFullDay) {
        const days = Math.floor(Math.abs(diff) / DAY);
        return `${plural(days, "day")} left`;
    }
    if (beyondHours) {
        const hours = Math.floor(Math.abs(diff) / HOUR);
        return `${plural(hours, "hour")} left`;
    }
    return `${Math.max(1, Math.floor(Math.abs(diff) / MINUTE))} min left`;
}

export function isOverdue(dueAt: string | null, completed: boolean, now: Date = new Date()): boolean {
    if (!dueAt || completed) return false;
    return new Date(dueAt).getTime() < now.getTime();
}

export function toDateTimeInputValue(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInputValue(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

export function relativeDayLabel(iso: string, now: Date = new Date()): string {
    const diff = startOfDay(now) - startOfDay(new Date(iso));
    const days = Math.round(diff / DAY);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days > 1 && days < 7) return `${plural(days, "day")} ago`;
    return formatShortDate(iso, now);
}
