import React from "react";
import { Badge, Card } from "../../ui.js";
import { formatCount } from "../../shared/utils.js";
/**
 * Logs display component for TesterPage
 */
export function TesterLogs({ job }) {
    return (React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-xl" },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700" }, "Log Runner"),
                    React.createElement("h2", { className: "mt-2 text-xl font-bold tracking-tight" }, "stdout + stderr")),
                React.createElement(Badge, { type: "ghost", className: "px-3 py-3" }, formatCount((job?.logs || []).length, "line"))),
            React.createElement("pre", { className: "max-h-[420px] overflow-auto rounded-sm bg-slate-950 p-5 text-xs leading-6 text-slate-100" }, (job?.logs || []).length ? job.logs.join("\n") : "Belum ada proses yang dijalankan."))));
}
