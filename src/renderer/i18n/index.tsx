import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { LanguageCode } from "@/db/schema";
import { setValidationTranslator } from "@/lib/validationMessages";
import { DICTIONARIES, type TranslationKey } from "./translations";

export type TranslateValues = Record<string, string | number>;

export interface I18nValue {
    language: LanguageCode;
    t: (key: TranslationKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, values?: TranslateValues): string {
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, token: string) =>
        token in values ? String(values[token]) : match
    );
}

export function translate(language: LanguageCode, key: TranslationKey, values?: TranslateValues): string {
    const dictionary = DICTIONARIES[language] ?? DICTIONARIES.en;
    // Fall back to English so a partially translated build never shows a raw key.
    const template = dictionary[key] ?? DICTIONARIES.en[key] ?? key;
    return interpolate(template, values);
}

export function I18nProvider({ language, children }: { language: LanguageCode; children: ReactNode }) {
    const t = useCallback(
        (key: TranslationKey, values?: TranslateValues) => translate(language, key, values),
        [language]
    );
    // ─── NEW: repository validation messages are produced far from React, so
    // we hand them the current translator whenever the language changes. ───
    useEffect(() => {
        setValidationTranslator((key) => translate(language, key as TranslationKey));
        return () => setValidationTranslator(null);
    }, [language]);
    const value = useMemo<I18nValue>(() => ({ language, t }), [language, t]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
    const value = useContext(I18nContext);
    if (!value) {
        // Non-provider callers (tests, isolated components) still get usable copy.
        return { language: "en", t: (key, values) => translate("en", key, values) };
    }
    return value;
}
