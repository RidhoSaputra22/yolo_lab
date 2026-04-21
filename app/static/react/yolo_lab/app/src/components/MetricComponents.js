import React from "react";
import { Card, Paragraph } from "../ui.js";
import { joinClasses } from "../shared/utils.js";
/**
 * Status metric card component used in dashboard/overview
 */
export function StatusMetric({ label, value, detail, tone = "" }) {
    return (React.createElement(Card, { compact: true, className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500" }, label),
        React.createElement("p", { className: joinClasses("mt-2 break-all text-sm font-semibold text-slate-900", tone) }, value),
        React.createElement(Paragraph, { className: "mt-2 text-xs" }, detail)));
}
/**
 * Metric tile component for displaying key metrics
 */
export function MetricTile({ label, value, detail, tone = "", textColor = "text-slate-900" }) {
    return (React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3" },
        React.createElement("p", { className: joinClasses("text-[11px] font-semibold uppercase tracking-[0.18em] ", textColor) }, label),
        React.createElement("p", { className: joinClasses("mt-2 text-base font-semibold ", tone) }, value),
        detail ? React.createElement("p", { className: joinClasses("mt-1 text-[11px] ", textColor) }, detail) : null));
}
