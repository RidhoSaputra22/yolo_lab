import React from "react";
import HelpTooltip from "./HelpTooltip.js";
export default function FieldLabel({ htmlFor, label, required = false, helpText = null, className = "", }) {
    if (!label) {
        return null;
    }
    return (React.createElement("div", { className: `label justify-start gap-2 ${className}`.trim() },
        React.createElement("label", { className: "label-text cursor-pointer font-medium", htmlFor: htmlFor },
            label,
            required ? React.createElement("span", { className: "ml-1 text-error" }, "*") : null),
        React.createElement(HelpTooltip, { label: label, text: helpText })));
}
