import React from "react";
import { LogDock } from "../../components/LogDock.js";
/**
 * Logs display component for TesterPage
 */
export function TesterLogs({ job }) {
    return (React.createElement(LogDock, { eyebrow: "Log Runner", title: "stdout + stderr", emptyMessage: "Belum ada proses yang dijalankan.", logs: job?.logs || [], state: job?.state || "idle", running: Boolean(job?.running), accentClass: "text-amber-700" }));
}
