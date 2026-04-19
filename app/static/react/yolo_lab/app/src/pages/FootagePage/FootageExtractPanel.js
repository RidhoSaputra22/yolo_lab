import React from "react";
import { Card } from "../../ui.js";
import { FormFieldControl } from "../../components/FormFieldControl.js";
export function FootageExtractPanel({ layout, formValues, suggestions, onFieldChange }) {
    return (React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", null,
                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500" }, "Extract Setup"),
                React.createElement("h3", { className: "mt-1 text-lg font-bold tracking-tight text-slate-900" }, "Atur frame step dan output extract")),
            React.createElement("div", { className: "grid gap-3" }, (layout || []).map((section) => (React.createElement("details", { key: section.id, open: true, className: "rounded-sm border border-base-300 bg-base-100/85" },
                React.createElement("summary", { className: "cursor-pointer list-none px-4 py-4" },
                    React.createElement("p", { className: "text-sm font-bold text-slate-900" }, section.title),
                    React.createElement("p", { className: "mt-1 text-xs text-slate-500" }, section.description)),
                React.createElement("div", { className: "grid gap-3 border-t border-base-300 px-4 py-4 sm:grid-cols-2" }, (section.fields || []).map((field) => (React.createElement(FormFieldControl, { key: field.name, field: field, value: formValues[field.name], suggestions: suggestions[field.name] || [], onChange: onFieldChange })))))))))));
}
