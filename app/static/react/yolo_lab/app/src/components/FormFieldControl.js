import React from "react";
import { FieldLabel, Input, Select, Textarea } from "../ui.js";
import { PathInput } from "./PathInput.js";
import { fieldValueToString } from "../shared/formHelpers.js";
/**
 * Generic form field control component
 * Renders different input types based on field configuration
 */
export function FormFieldControl({ field, value, suggestions, onChange }) {
    const selectOptions = (field.choices || []).map((choice) => typeof choice === "string"
        ? { value: choice, label: choice }
        : { value: choice.value, label: choice.label || choice.value });
    if (field.type === "bool") {
        return (React.createElement("div", { className: "form-control w-full" },
            React.createElement(FieldLabel, { htmlFor: field.name, label: field.label, helpText: field.helpText || null }),
            React.createElement("label", { htmlFor: field.name, className: "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-base-300 bg-base-100/80 px-4 transition-colors hover:border-base-content/20" },
                React.createElement("input", { id: field.name, type: "checkbox", name: field.name, checked: Boolean(value), className: "checkbox checkbox-primary", onChange: (event) => onChange(field.name, event.target.checked) }),
                React.createElement("span", { className: "text-sm text-base-content/80" }, value ? "Aktif" : "Nonaktif"))));
    }
    if (field.type === "textarea") {
        return (React.createElement(Textarea, { name: field.name, label: field.label, rows: 4, placeholder: field.placeholder || "", helpText: field.helpText || null, value: fieldValueToString(value), onChange: (event) => onChange(field.name, event.target.value) }));
    }
    if (field.type === "select") {
        return (React.createElement(Select, { name: field.name, label: field.label, value: fieldValueToString(value), onChange: (event) => onChange(field.name, event.target.value), options: selectOptions, placeholder: "Pilih...", helpText: field.helpText || null }));
    }
    if (field.type === "path") {
        return (React.createElement(PathInput, { name: field.name, label: field.label, value: fieldValueToString(value), suggestions: suggestions, onChange: (newValue) => onChange(field.name, newValue), required: Boolean(field.required), helpText: field.helpText || null, placeholder: field.placeholder || "" }));
    }
    return (React.createElement(Input, { name: field.name, label: field.label, type: field.type === "int" || field.type === "float" ? "number" : "text", step: field.type === "float" ? "0.01" : field.type === "int" ? "1" : undefined, required: Boolean(field.required), helpText: field.helpText || null, placeholder: field.placeholder || "", value: fieldValueToString(value), onChange: (event) => onChange(field.name, event.target.value) }));
}
