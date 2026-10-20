/**
 * Validation messages are produced deep inside the repositories, far from React.
 * Instead of threading a translator through every call, the app registers the
 * active translator here whenever the language changes. The repositories fall
 * back to English when no translator has been registered (tests, scripts).
 */
export type ValidationTranslator = (key: string) => string;

let activeTranslator: ValidationTranslator | null = null;

export function setValidationTranslator(translator: ValidationTranslator | null): void {
    activeTranslator = translator;
}

export function validationMessage(key: string, fallback: string): string {
    if (!activeTranslator) return fallback;
    const translated = activeTranslator(key);
    // The translator returns the key itself when it has no entry for it.
    return translated && translated !== key ? translated : fallback;
}
