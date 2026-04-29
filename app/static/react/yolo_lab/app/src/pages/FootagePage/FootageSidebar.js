import React from "react";
import { Badge, Card } from "../../ui.js";
import { MetricTile } from "../../components/MetricComponents.js";
export function FootageSidebar({ runtimePaths, library }) {
    return (React.createElement("aside", { className: "grid h-fit gap-4 xl:sticky xl:top-28" },
        React.createElement(Card, { className: "rounded-md border border-base-300 bg-slate-900 text-slate-50 shadow-xl" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200" }, "Runtime"),
                    React.createElement("h2", { className: "mt-1 text-lg font-bold tracking-tight" }, "Footage Workspace")),
                React.createElement("div", { className: "grid gap-2 text-xs text-slate-200" }, [
                    ["Project", runtimePaths?.projectDir || "-"],
                    ["Trainer", runtimePaths?.trainScript || "-"],
                    ["Python", runtimePaths?.pythonBin || "-"],
                    ["Footage", library?.footageDir || runtimePaths?.defaultFootageDir || "-"],
                    ["Frames", library?.framesDir || runtimePaths?.defaultFramesDir || "-"],
                    ["Labels", library?.labelsDir || runtimePaths?.defaultLabelsDir || "-"],
                ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-md border border-white/10 bg-white/5 px-3 py-2" },
                    React.createElement("p", { className: "text-[10px] uppercase tracking-[0.18em] text-slate-400" }, label),
                    React.createElement("p", { className: "mt-1 break-all font-mono text-[11px] text-slate-100" }, value))))),
                React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    React.createElement(MetricTile, { label: "Footage", value: String(library?.footageCount ?? "-"), detail: library?.totalFootageSizeLabel || "-" }),
                    React.createElement(MetricTile, { label: "Frames", value: String(library?.frameCount ?? "-"), detail: `${library?.labeledFrameCount ?? "-"} labeled` }))))));
}
