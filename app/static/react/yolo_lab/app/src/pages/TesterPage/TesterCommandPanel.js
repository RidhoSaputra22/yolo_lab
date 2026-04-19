import React from "react";
import { Alert, Badge, Card } from "../../ui.js";
import { formatCount, formatTimestamp } from "../../shared/utils.js";
/**
 * Command preview and job summary panel for TesterPage
 */
export function TesterCommandPanel({ preview, previewError, previewState, job, defaults, }) {
    const previewBadge = {
        idle: { type: "ghost", label: "menunggu" },
        loading: { type: "info", label: "memuat" },
        ready: { type: "success", label: "sinkron" },
        error: { type: "error", label: "error" },
    }[previewState] || { type: "ghost", label: "menunggu" };
    return (React.createElement("div", { className: "grid gap-4" },
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-slate-950 text-slate-100 shadow-lg" },
            React.createElement("div", { className: "space-y-3" },
                React.createElement("div", { className: "flex items-center justify-between gap-3" },
                    React.createElement("h3", { className: "text-lg font-bold" }, "Command"),
                    React.createElement(Badge, { type: previewBadge.type, className: "border-none px-3 py-3" }, previewBadge.label)),
                React.createElement("pre", { className: "max-h-[260px] overflow-auto rounded-sm bg-slate-900/70 p-4 text-xs leading-6 text-slate-100" }, previewError ||
                    preview?.commandDisplay ||
                    "Isi form konfigurasi untuk melihat command runner."))),
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                    React.createElement("h3", { className: "text-lg font-bold" }, "Ringkasan Job"),
                    React.createElement(Badge, { type: job?.error ? "error" : "ghost", className: "px-3 py-3" }, formatCount((job?.artifacts || []).length, "artifact"))),
                job?.error ? (React.createElement(Alert, { type: "error", className: "rounded-sm text-sm" }, job.error)) : null,
                React.createElement("div", { className: "grid gap-3" }, [
                    ["Started", formatTimestamp(job?.startedAt)],
                    ["Finished", formatTimestamp(job?.finishedAt)],
                    ["Output Dir", job?.outputDir || defaults.outputDir || "-"],
                    ["Command", job?.commandDisplay || "-"],
                ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-sm border border-base-300 bg-base-200/50 p-3" },
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
                    React.createElement("p", { className: "mt-2 break-all font-mono text-[12px] text-slate-900" }, value)))))))));
}
