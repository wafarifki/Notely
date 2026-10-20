const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ─── NEW: month names follow the interface language instead of always English. ───
const MONTHS: Record<"en" | "id", string[]> = {
    en: [
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
    ],
    id: [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"
    ]
};

function months(language: string): string[] {
    return MONTHS[language === "id" ? "id" : "en"];
}

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

export function formatFullDate(iso: string, language: string = "en"): string {
    const date = new Date(iso);
    const month = months(language)[date.getMonth()];
    // Indonesian dates do not use an ordinal suffix: "5 Oktober 2026".
    if (language === "id") return `${date.getDate()} ${month} ${date.getFullYear()}`;
    return `${date.getDate()}${ordinal(date.getDate())} ${month}, ${date.getFullYear()}`;
}

export function formatShortDate(iso: string, now: Date = new Date(), language: string = "en"): string {
    const date = new Date(iso);
    if (date.getFullYear() === now.getFullYear()) {
        const month = months(language)[date.getMonth()];
        if (language === "id") return `${date.getDate()} ${month.slice(0, 3)}`;
        return `${date.getDate()}${ordinal(date.getDate())} ${month.slice(0, 3)}`;
    }
    return formatFullDate(iso, language);
}

function startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function plural(value: number, singular: string, pluralForm = `${singular}s`): string {
    return `${value} ${value === 1 ? singular : pluralForm}`;
}

// ─── NEW: due-date labels accept a translator so "3 hours left" becomes
// "tersisa 3 jam" in Indonesian. Typed against the date keys only so any
// translator (including the typed `t` from useI18n) can be passed in.
// The signature stays backward compatible for callers that only need English. ───
export type DateTranslationKey =
    | "date.noDue"
    | "date.dayOverdue"
    | "date.daysOverdue"
    | "date.hourOverdue"
    | "date.hoursOverdue"
    | "date.minOverdue"
    | "date.dayLeft"
    | "date.daysLeft"
    | "date.hourLeft"
    | "date.hoursLeft"
    | "date.minLeft"
    | "date.today"
    | "date.yesterday"
    | "date.daysAgo";

export type DateTranslator = (key: DateTranslationKey, values?: Record<string, string | number>) => string;

export function formatDueLabel(
    dueAt: string | null,
    now: Date = new Date(),
    t?: DateTranslator
): string {
    if (!dueAt) return t ? t("date.noDue") : "No due date";
    const due = new Date(dueAt).getTime();
    const diff = due - now.getTime();
    const beyondHours = Math.abs(diff) >= HOUR;
    const beyondFullDay = Math.abs(diff) >= DAY;

    // Pick the singular or plural key, then either translate it or build the
    // English fallback with the same word order.
    const say = (
        oneKey: DateTranslationKey,
        manyKey: DateTranslationKey,
        count: number,
        unit: string,
        suffix: string
    ) => {
        if (t) return t(count === 1 ? oneKey : manyKey, { count });
        return `${plural(count, unit)} ${suffix}`;
    };

    if (diff < 0) {
        if (beyondFullDay) {
            const days = Math.floor(Math.abs(diff) / DAY);
            return say("date.dayOverdue", "date.daysOverdue", days, "day", "overdue");
        }
        if (beyondHours) {
            const hours = Math.floor(Math.abs(diff) / HOUR);
            return say("date.hourOverdue", "date.hoursOverdue", hours, "hour", "overdue");
        }
        const minutes = Math.max(1, Math.floor(Math.abs(diff) / MINUTE));
        return t ? t("date.minOverdue", { count: minutes }) : `${minutes} min overdue`;
    }

    if (beyondFullDay) {
        const days = Math.floor(Math.abs(diff) / DAY);
        return say("date.dayLeft", "date.daysLeft", days, "day", "left");
    }
    if (beyondHours) {
        const hours = Math.floor(Math.abs(diff) / HOUR);
        return say("date.hourLeft", "date.hoursLeft", hours, "hour", "left");
    }
    const minutes = Math.max(1, Math.floor(Math.abs(diff) / MINUTE));
    return t ? t("date.minLeft", { count: minutes }) : `${minutes} min left`;
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

export function relativeDayLabel(iso: string, now: Date = new Date(), t?: DateTranslator, language = "en"): string {
    const diff = startOfDay(now) - startOfDay(new Date(iso));
    const days = Math.round(diff / DAY);
    if (days === 0) return t ? t("date.today") : "Today";
    if (days === 1) return t ? t("date.yesterday") : "Yesterday";
    if (days > 1 && days < 7) {
        if (t) return t("date.daysAgo", { count: days });
        return `${plural(days, "day")} ago`;
    }
    return formatShortDate(iso, now, language);
}
