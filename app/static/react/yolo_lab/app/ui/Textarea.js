import React from "react";
/**
 * Textarea component styled with DaisyUI v4 form-control
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.placeholder
 * @param {string} props.value
 * @param {function} props.onChange
 * @param {string} props.error
 * @param {boolean} props.required
 * @param {number} props.rows
 * @param {string} props.className
 */
export default function Textarea({ label, placeholder = "", value = "", onChange, error = null, required = false, helpText = null, rows = 4, className = "", name, ...rest }) {
    const textareaId = name || label || Math.random().toString(36).slice(2, 10);
    return (React.createElement("div", { className: `form-control w-full ${className}` },
        label && (React.createElement("label", { className: "label", htmlFor: textareaId },
            React.createElement("span", { className: "label-text font-medium" },
                label,
                required && React.createElement("span", { className: "text-error ml-1" }, "*")))),
        React.createElement("textarea", { id: textareaId, name: name, placeholder: placeholder, value: value, onChange: onChange, required: required, rows: rows, className: `textarea textarea-bordered w-full font-mono${error ? " textarea-error" : ""}`, ...rest }),
        helpText && !error && (React.createElement("label", { className: "label" },
            React.createElement("span", { className: "label-text-alt text-base-content/70" }, helpText))),
        error && (React.createElement("label", { className: "label" },
            React.createElement("span", { className: "label-text-alt text-error" }, error)))));
}
