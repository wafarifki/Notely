import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "@/theme/applyTheme";
import { useI18n } from "@/i18n";
import { TOUR_STEPS, useUiTour } from "./useUiTour";

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const PADDING = 8;

function measure(target: string, fallback?: string): Rect | null {
    const element =
        document.querySelector<HTMLElement>(target) ?? (fallback ? document.querySelector<HTMLElement>(fallback) : null);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function TourOverlay() {
    const tour = useUiTour();
    const { t } = useI18n();
    const [rect, setRect] = useState<Rect | null>(null);
    const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
    const cardRef = useRef<HTMLDivElement>(null);
    const nextButtonRef = useRef<HTMLButtonElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);
    const reducedMotion = prefersReducedMotion();
    const step = TOUR_STEPS[tour.step];

    const { active, step: stepIndex, setComplete } = tour;

    useLayoutEffect(() => {
        if (!active) return;
        restoreFocusRef.current = document.activeElement as HTMLElement | null;
        let cancelled = false;
        let attempt = 0;

        const update = () => {
            if (cancelled) return;
            const next = measure(TOUR_STEPS[stepIndex].target, TOUR_STEPS[stepIndex].fallback);
            if (next) {
                const scroller = document.querySelector<HTMLElement>(".app-scroll");
                if (scroller) {
                    const target = document.querySelector<HTMLElement>(TOUR_STEPS[stepIndex].target);
                    target?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
                }
                window.setTimeout(() => {
                    if (cancelled) return;
                    const settled = measure(TOUR_STEPS[stepIndex].target, TOUR_STEPS[stepIndex].fallback);
                    setRect(settled ?? next);
                    setComplete();
                }, reducedMotion ? 0 : 320);
                return;
            }
            if (attempt < 20) {
                attempt += 1;
                window.setTimeout(update, 120);
                return;
            }
            setRect(null);
            setComplete();
        };

        const timer = window.setTimeout(update, reducedMotion ? 0 : 220);
        const handleResize = () => {
            const next = measure(TOUR_STEPS[stepIndex].target, TOUR_STEPS[stepIndex].fallback);
            if (next) setRect(next);
        };
        window.addEventListener("resize", handleResize);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            window.removeEventListener("resize", handleResize);
        };
    }, [active, stepIndex, reducedMotion, setComplete]);

    useEffect(() => {
        if (!tour.active) return;
        const card = cardRef.current;
        if (card) {
            setTooltipSize({ width: card.offsetWidth, height: card.offsetHeight });
        }
        nextButtonRef.current?.focus();
    }, [tour.active, tour.step, rect]);

    const finish = useCallback(() => {
        tour.stopTour();
        restoreFocusRef.current?.focus?.();
    }, [tour]);

    useEffect(() => {
        if (!tour.active) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                finish();
            } else if (event.key === "ArrowRight" || event.key === "Enter") {
                if (tour.step >= TOUR_STEPS.length - 1) finish();
                else tour.goToStep(tour.step + 1);
            } else if (event.key === "ArrowLeft") {
                if (tour.step > 0) tour.goToStep(tour.step - 1);
            }
        };
        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [tour, finish]);

    if (!tour.active) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = tooltipSize.width || 330;
    const height = tooltipSize.height || 220;

    let top = viewportHeight / 2 - height / 2;
    let left = viewportWidth / 2 - width / 2;

    if (rect) {
        const spot = {
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2
        };
        const gap = 16;
        const candidates: Record<string, { top: number; left: number }> = {
            right: { top: spot.top, left: spot.left + spot.width + gap },
            left: { top: spot.top, left: spot.left - width - gap },
            bottom: { top: spot.top + spot.height + gap, left: spot.left },
            top: { top: spot.top - height - gap, left: spot.left }
        };
        const order = [step.placement, "bottom", "right", "left", "top"];
        const fits = (position: { top: number; left: number }) =>
            position.top >= 12 &&
            position.left >= 12 &&
            position.top + height <= viewportHeight - 12 &&
            position.left + width <= viewportWidth - 12;
        const chosen = order.map((placement) => candidates[placement]).find(fits) ?? candidates.bottom;
        top = Math.min(Math.max(12, chosen.top), viewportHeight - height - 12);
        left = Math.min(Math.max(12, chosen.left), viewportWidth - width - 12);
    }

    const spotlight = rect
        ? {
              top: rect.top - PADDING,
              left: rect.left - PADDING,
              width: rect.width + PADDING * 2,
              height: rect.height + PADDING * 2
          }
        : null;

    return createPortal(
        <div className={`tour-layer${reducedMotion ? " is-static" : ""}`} role="dialog" aria-modal="true" aria-label={t("a11y.productTour")}>
            {spotlight ? (
                <>
                    <div className="tour-scrim tour-scrim-top" style={{ height: Math.max(0, spotlight.top) }} />
                    <div
                        className="tour-scrim tour-scrim-left"
                        style={{ top: spotlight.top, height: spotlight.height, width: Math.max(0, spotlight.left) }}
                    />
                    <div
                        className="tour-scrim tour-scrim-right"
                        style={{
                            top: spotlight.top,
                            height: spotlight.height,
                            left: spotlight.left + spotlight.width,
                            right: 0
                        }}
                    />
                    <div
                        className="tour-scrim tour-scrim-bottom"
                        style={{ top: spotlight.top + spotlight.height, bottom: 0 }}
                    />
                    <div className="tour-spotlight" style={spotlight} aria-hidden="true" />
                </>
            ) : (
                <div className="tour-scrim tour-scrim-full" />
            )}

            <div ref={cardRef} className="tour-card" style={{ top, left }} role="document">
                <div className="tour-card-head">
                    <span className="tour-badge">
                        <Compass size={13} strokeWidth={2} aria-hidden="true" />
                        {t("tour.stepOf", { current: tour.step + 1, total: TOUR_STEPS.length })}
                    </span>
                    <button type="button" className="icon-button" onClick={finish} aria-label={t("tour.endTour")}>
                        <X size={14} strokeWidth={2} />
                    </button>
                </div>
                <h3 className="tour-title">{t(step.titleKey)}</h3>
                <p className="tour-body">{t(step.bodyKey)}</p>
                <div className="tour-progress" aria-hidden="true">
                    {TOUR_STEPS.map((_, index) => (
                        <span key={index} className={index <= tour.step ? "is-on" : ""} />
                    ))}
                </div>
                <div className="tour-actions">
                    <button type="button" className="button button-quiet button-small" onClick={finish}>
                        {t("tour.skip")}
                    </button>
                    <span className="tour-actions-spacer" />
                    {tour.step > 0 ? (
                        <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() => tour.goToStep(tour.step - 1)}
                        >
                            <ArrowLeft size={13} strokeWidth={2} aria-hidden="true" />
                            {t("tour.back")}
                        </button>
                    ) : null}
                    <button
                        ref={nextButtonRef}
                        type="button"
                        className="button button-primary button-small"
                        onClick={() => {
                            if (tour.step >= TOUR_STEPS.length - 1) finish();
                            else tour.goToStep(tour.step + 1);
                        }}
                    >
                        {tour.step >= TOUR_STEPS.length - 1 ? t("tour.gotIt") : t("tour.next")}
                        {tour.step >= TOUR_STEPS.length - 1 ? null : (
                            <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
