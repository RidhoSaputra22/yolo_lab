import React from "react";
import { Badge, Card } from "../../ui.js";
import { MetricTile } from "../../components/MetricComponents.js";
/**
 * TrainingSidebar - Compact runtime config + dataset snapshot
 * Actions and warnings have been moved to the top toolbar.
 */
export function TrainingSidebar({ workspace, runtimePaths }) {
    return (React.createElement("aside", { className: "grid h-fit min-w-0 gap-4 xl:sticky xl:top-28" },
        React.createElement(Card, { className: "min-w-0 rounded-sm border border-base-300 bg-slate-900 text-slate-50 shadow-xl" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200" }, "Runtime"),
                    React.createElement("h2", { className: "mt-1 text-lg font-bold tracking-tight" }, "Training Workspace")),
                React.createElement("div", { className: "grid gap-2 text-xs text-slate-200" }, [
                    ["Project", runtimePaths?.projectDir || "-"],
                    ["Trainer", runtimePaths?.trainScript || "-"],
                    ["Python", runtimePaths?.pythonBin || "-"],
                    ["Runs Dir", runtimePaths?.defaultRunsDir || "-"],
                ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-sm border border-white/10 bg-white/5 px-3 py-2" },
                    React.createElement("p", { className: "text-[10px] uppercase tracking-[0.18em] text-slate-400" }, label),
                    React.createElement("p", { className: "text-wrap-anywhere mt-1 font-mono text-[11px] text-slate-100" }, value))))),
                React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    React.createElement(MetricTile, { label: "Frames", value: String(workspace?.frameCount ?? "-") }),
                    React.createElement(MetricTile, { label: "Labels", value: String(workspace?.labelCount ?? "-") })))),
        React.createElement(Card, { className: "min-w-0 rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
            React.createElement("div", { className: "space-y-3" },
                React.createElement("div", { className: "flex items-center justify-between gap-2" },
                    React.createElement("h3", { className: "text-sm font-bold" }, "Dataset"),
                    React.createElement(Badge, { type: workspace?.dataYamlExists ? "success" : "warning", className: "px-3 py-2" }, workspace?.dataYamlExists ? "data.yaml ✓" : "cek dataset")),
                React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    React.createElement(MetricTile, { label: "Train", value: String(workspace?.datasetTrainImages ?? "-"), detail: `${workspace?.datasetTrainLabels ?? "-"} label`, textColor: 'text-black' }),
                    React.createElement(MetricTile, { label: "Val", value: String(workspace?.datasetValImages ?? "-"), detail: `${workspace?.datasetValLabels ?? "-"} label`, textColor: 'text-black' })),
                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 px-3 py-2" },
                    React.createElement("p", { className: "text-[10px] font-semibold uppercase tracking-[0.18em] text-black" }, "Class"),
                    React.createElement("div", { className: "mt-2 flex flex-wrap gap-1" }, (workspace?.classNames || []).length ? (workspace.classNames.map((className) => (React.createElement(Badge, { key: className, type: "warning", className: "px-2 py-1" }, className)))) : (React.createElement("span", { className: "text-xs text-slate-400" }, "Belum ada class"))))))));
}
