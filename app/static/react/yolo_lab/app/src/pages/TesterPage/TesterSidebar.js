import React from "react";
import { Card } from "../../ui.js";
/**
 * TesterSidebar - Compact runtime config only.
 * Actions and warnings have been moved to the top toolbar.
 */
export function TesterSidebar({ runtimePaths }) {
    return (React.createElement("aside", { className: "grid h-fit gap-4 xl:sticky xl:top-28" },
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-slate-900 text-slate-50 shadow-xl" },
            React.createElement("div", { className: "space-y-3" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200" }, "Runtime"),
                    React.createElement("h2", { className: "mt-1 text-lg font-bold tracking-tight" }, "Tester Workspace")),
                runtimePaths ? (React.createElement("div", { className: "grid gap-2 text-xs text-slate-200" }, [
                    ["Project", runtimePaths.projectDir],
                    ["Runner", runtimePaths.runnerScript],
                    ["Python", runtimePaths.pythonBin],
                    ["Output", runtimePaths.defaultOutputDir],
                ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-sm border border-white/10 bg-white/5 px-3 py-2" },
                    React.createElement("p", { className: "text-[10px] uppercase tracking-[0.18em] text-slate-400" }, label),
                    React.createElement("p", { className: "mt-1 break-all font-mono text-[11px] text-slate-100" }, value)))))) : (React.createElement("p", { className: "text-xs text-slate-300" }, "Memuat runtime config..."))))));
}
