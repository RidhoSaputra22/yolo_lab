import React from "react";
import { Alert, Badge, Card } from "../../ui.js";
import { formatTimestamp } from "../../shared/utils.js";
export function FootageCommandPanel({ preview, previewError, previewState, job, defaults, }) {
    const previewBadge = {
        idle: { type: "ghost", label: "menunggu" },
        loading: { type: "info", label: "memuat" },
        ready: { type: "success", label: "sinkron" },
        error: { type: "error", label: "error" },
    }[previewState] || { type: "ghost", label: "menunggu" };
    return (React.createElement(Card, { className: "rounded-md border border-base-300 bg-base-100/90 shadow-lg" },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500" }, "Command Preview"),
                    React.createElement("h3", { className: "mt-1 text-lg font-bold tracking-tight text-slate-900" }, "Preview command ekstraksi")),
                React.createElement(Badge, { type: previewBadge.type, className: "px-3 py-3" }, previewBadge.label)),
            previewError ? (React.createElement(Alert, { type: "error", className: "rounded-md text-sm" }, previewError)) : null,
            job?.error ? (React.createElement(Alert, { type: "error", className: "rounded-md text-sm" }, job.error)) : null,
            React.createElement("div", { className: "grid gap-3 lg:grid-cols-2" },
                React.createElement("div", { className: "rounded-md border border-base-300 bg-slate-950 p-4" },
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400" }, "Command"),
                    React.createElement("pre", { className: "mt-3 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-100" }, preview?.commandDisplay || "-")),
                React.createElement("div", { className: "grid gap-3" }, [
                    ["Footage dir", preview?.config?.footageDir || defaults.footageDir || "-"],
                    ["Frames dir", preview?.config?.framesDir || defaults.framesDir || "-"],
                    [
                        "Estimated frames",
                        String(preview?.config?.estimatedFrameCount ?? defaults.estimatedFrameCount ?? "-"),
                    ],
                    ["Frame step", String(preview?.config?.sampleEvery ?? defaults.sampleEvery ?? "-")],
                    [
                        "Max per video",
                        String(preview?.config?.maxFramesPerVideo ?? defaults.maxFramesPerVideo ?? "-"),
                    ],
                    ["JPEG quality", String(preview?.config?.jpegQuality ?? defaults.jpegQuality ?? "-")],
                    ["Started", formatTimestamp(job?.startedAt)],
                    ["Finished", formatTimestamp(job?.finishedAt)],
                    ["Output dir", job?.outputDir || preview?.config?.framesDir || defaults.framesDir || "-"],
                ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-md border border-base-300 bg-base-200/50 p-3" },
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
                    React.createElement("p", { className: "mt-2 break-all font-mono text-[12px] text-slate-900" }, value)))))))));
}
