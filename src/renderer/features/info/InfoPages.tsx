import { ArrowLeft, Gift, LifeBuoy, ShieldCheck } from "lucide-react";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";

function InfoShell({
    icon: Icon,
    title,
    intro,
    children
}: {
    icon: typeof LifeBuoy;
    title: string;
    intro: string;
    children: React.ReactNode;
}) {
    const workflows = useWorkflows();
    const { t } = useI18n();
    return (
        <div className="page info-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "home" })}>
                    <ArrowLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                    {t("nav.home")}
                </button>
            </div>
            <header className="info-header">
                <span className="info-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.7} />
                </span>
                <h1 className="page-title">{title}</h1>
                <p className="page-subtitle">{intro}</p>
            </header>
            <div className="info-content">{children}</div>
        </div>
    );
}

export function SupportPage() {
    const { t } = useI18n();
    return (
        <InfoShell icon={LifeBuoy} title={t("info.supportTitle")} intro={t("info.supportIntro")}>
            <section className="panel info-card">
                <h2>{t("info.whereData")}</h2>
                <p>{t("info.whereDataText")}</p>
            </section>
            <section className="panel info-card">
                <h2>{t("info.backupTitle")}</h2>
                <p>{t("info.backupText")}</p>
            </section>
            <section className="panel info-card">
                <h2>{t("info.notSavedTitle")}</h2>
                <p>{t("info.notSavedText")}</p>
            </section>
            <section className="panel info-card">
                <h2>{t("info.issuesTitle")}</h2>
                <p className="info-contact">
                    <a href="https://github.com/wafarifki/Notely/issues" target="_blank" rel="noreferrer noopener">
                        {t("info.issuesLink")}
                    </a>
                </p>
            </section>
        </InfoShell>
    );
}

export function WhatsNewPage() {
    const { t } = useI18n();
    return (
        <InfoShell icon={Gift} title={t("info.whatsNewTitle")} intro={t("info.whatsNewIntro")}>
            <section className="panel info-card">
                <h2>{t("info.version", { version: "1.0.0" })}</h2>
                <ul className="info-list">
                    <li>{t("info.whatsNew.item1")}</li>
                    <li>{t("info.whatsNew.item2")}</li>
                    <li>{t("info.whatsNew.item3")}</li>
                    <li>{t("info.whatsNew.item4")}</li>
                    <li>{t("info.whatsNew.item5")}</li>
                </ul>
            </section>
        </InfoShell>
    );
}

export function PrivacyPage() {
    const { t } = useI18n();
    return (
        <InfoShell icon={ShieldCheck} title={t("info.privacyTitle")} intro={t("info.privacyIntro")}>
            <section className="panel info-card">
                <h2>{t("info.noCollection")}</h2>
                <p>{t("info.noCollectionText")}</p>
            </section>
            <section className="panel info-card">
                <h2>{t("info.localStorage")}</h2>
                <p>{t("info.localStorageText")}</p>
            </section>
            <section className="panel info-card">
                <h2>{t("info.control")}</h2>
                <p>{t("info.controlText")}</p>
            </section>
        </InfoShell>
    );
}
