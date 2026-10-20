import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/dashboard.css";
import "./styles/pages.css";
import "./styles/motion.css";
import "./styles/archive.css";
import "./styles/checklist.css";
import { App } from "./App";

const container = document.getElementById("root");

if (!container) {
    throw new Error("Root container is missing");
}

createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>
);
