import React from "react";
import { Card, Paragraph } from "../ui.js";
import { joinClasses } from "../shared/utils.js";
/**
 * Status metric card component used in dashboard/overview
 */
export function StatusMetric({ label, value, detail, tone = "" }) {
    return (React.createElement(Card, { compact: true, className: "rounded-md border border-base-300 bg-base-100/90 shadow-lg" },
        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-base-content/60" }, label),
        React.createElement("p", { className: joinClasses("mt-2 break-all text-sm font-semibold text-base-content", tone) }, value),
        React.createElement(Paragraph, { className: "mt-2 text-xs" }, detail)));
}
/**
 * Metric tile component for displaying key metrics
 */
export function MetricTile({ label, value, detail, tone = "", textColor = "" }) {
    return (React.createElement("div", { className: "yolo-muted-panel rounded-md border border-base-300 bg-base-200/40 p-3" },
        React.createElement("p", { className: joinClasses("text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/60", textColor) }, label),
        React.createElement("p", { className: joinClasses("mt-2 text-base font-semibold text-base-content", tone) }, value),
        detail ? React.createElement("p", { className: "mt-1 text-[11px] text-base-content/60" }, detail) : null));
}
