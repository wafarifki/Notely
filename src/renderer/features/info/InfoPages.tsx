import { ArrowLeft, Gift, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { useWorkflows } from "@/feature-hooks";

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
    return (
        <div className="page info-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "home" })}>
                    <ArrowLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                    Home
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
    return (
        <InfoShell
            icon={LifeBuoy}
            title="Support"
            intro="Notely is a local-only app, so most issues can be solved right here."
        >
            <section className="panel info-card">
                <h2>Where is my data stored?</h2>
                <p>
                    Everything lives in this device&apos;s app data folder, inside a private IndexedDB database. When
                    Notely is installed on Windows the folder is{" "}
                    <code>%APPDATA%\Notely</code>. Uninstalling the app does not touch it.
                </p>
            </section>
            <section className="panel info-card">
                <h2>Back up safely</h2>
                <p>
                    Open <strong>Settings → Your data</strong> and choose <strong>Export JSON</strong> before
                    reinstalling Windows or moving to another computer. Import the same file there to restore
                    everything, including tags and projects.
                </p>
            </section>
            <section className="panel info-card">
                <h2>A change did not save</h2>
                <p>
                    If the editor says <em>Unable to save</em>, your browser storage may be full. Export a backup,
                    restart the app, and import it again. Nothing is ever sent to a server.
                </p>
            </section>
            <section className="panel info-card">
                <h2>Contact</h2>
                <p className="info-contact">
                    <Mail size={14} strokeWidth={1.8} aria-hidden="true" />
                    feedback@notely.local
                </p>
            </section>
        </InfoShell>
    );
}

export function WhatsNewPage() {
    return (
        <InfoShell icon={Gift} title="What's new" intro="Recent improvements in this build of Notely.">
            <section className="panel info-card">
                <h2>Version 1.0.0</h2>
                <ul className="info-list">
                    <li>Projects, notes and tasks with a shared dashboard overview.</li>
                    <li>Autosaving note editor with pinning, favorites and tag filters.</li>
                    <li>Drag-and-drop ordering for project and note cards.</li>
                    <li>Recent activity for every change, stored locally.</li>
                    <li>JSON export and validated import, plus a demo workspace reset.</li>
                </ul>
            </section>
        </InfoShell>
    );
}

export function PrivacyPage() {
    return (
        <InfoShell
            icon={ShieldCheck}
            title="Privacy Policy"
            intro="Short version: your notes never leave this computer."
        >
            <section className="panel info-card">
                <h2>No collection</h2>
                <p>
                    Notely does not contain analytics, crash reporting, ads or accounts. The app makes no network
                    requests at runtime and works with the network disconnected.
                </p>
            </section>
            <section className="panel info-card">
                <h2>Local storage</h2>
                <p>
                    Projects, notes, tasks, tags, settings and activity are written to IndexedDB inside the app&apos;s
                    user data directory. Files you export or import are handled entirely on this device.
                </p>
            </section>
            <section className="panel info-card">
                <h2>Your control</h2>
                <p>
                    Delete individual items at any time, or use <strong>Settings → Your data</strong> to export,
                    reset or clear everything. Clearing removes the records permanently from this device.
                </p>
            </section>
        </InfoShell>
    );
}
