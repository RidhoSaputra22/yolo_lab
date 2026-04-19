import React, { useState } from "react";
/**
 * Select component styled with DaisyUI v4 form-control
 * @param {object} props
 * @param {string} props.label
 * @param {Array<{value:string,label:string}>} props.options
 * @param {string} props.value
 * @param {function} props.onChange
 * @param {string} props.placeholder
 * @param {string} props.error
 * @param {boolean} props.required
 * @param {boolean} props.searchable
 * @param {string} props.searchPlaceholder
 * @param {string} props.className
 */
export default function Select({ label, options = [], value = "", onChange, placeholder = "Pilih...", error = null, required = false, helpText = null, searchable = false, searchPlaceholder = "Cari...", className = "", name, ...rest }) {
    const [searchTerm, setSearchTerm] = useState("");
    const selectId = name || label || Math.random().toString(36).slice(2, 10);
    const filteredOptions = searchable
        ? options.filter((o) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
        : options;
    return (React.createElement("div", { className: `form-control w-full ${className}` },
        label && (React.createElement("label", { className: "label", htmlFor: selectId },
            React.createElement("span", { className: "label-text font-medium" },
                label,
                required && React.createElement("span", { className: "text-error ml-1" }, "*")))),
        searchable && (React.createElement("input", { type: "text", className: "input input-bordered input-sm mb-2", placeholder: searchPlaceholder, value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })),
        React.createElement("select", { id: selectId, name: name, value: value, onChange: onChange, required: required, className: `select select-bordered w-full${error ? " select-error" : ""}`, ...rest },
            React.createElement("option", { value: "", disabled: true }, placeholder),
            filteredOptions.map((o) => (React.createElement("option", { key: o.value, value: o.value }, o.label)))),
        helpText && !error && (React.createElement("label", { className: "label" },
            React.createElement("span", { className: "label-text-alt text-base-content/70" }, helpText))),
        error && (React.createElement("label", { className: "label" },
            React.createElement("span", { className: "label-text-alt text-error" }, error)))));
}
