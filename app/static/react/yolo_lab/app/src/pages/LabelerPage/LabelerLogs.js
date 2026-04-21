import React from "react";
import { LogDock } from "../../components/LogDock.js";
export function LabelerLogs({ job }) {
    return (React.createElement(LogDock, { eyebrow: "Log Auto-Label", title: "stdout + stderr", emptyMessage: "Belum ada proses auto-label yang dijalankan.", logs: job?.logs || [], state: job?.state || "idle", running: Boolean(job?.running), accentClass: "text-amber-700" }));
}
