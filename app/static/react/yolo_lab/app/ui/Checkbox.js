import React from "react";
import FieldLabel from "./FieldLabel.js";
/**
 * Checkbox component styled with DaisyUI v4 form-control
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.label
 * @param {Array<{value:string,label:string,disabled?:boolean}>} props.options
 * @param {Array<string>} props.checked
 * @param {boolean} props.required
 * @param {"horizontal"|"vertical"} props.layout
 * @param {string} props.helpText
 * @param {boolean} props.single
 * @param {function} props.onChange
 * @param {string} props.className
 * @param {string} props.error
 */
export default function Checkbox({ name, label = null, options = [], checked = [], required = false, layout = "horizontal", helpText = null, single = false, onChange, className = "", error = null, ...rest }) {
    // Handler for single or multiple
    const handleChange = (e) => {
        if (single) {
            onChange && onChange(e.target.checked ? ["1"] : []);
        }
        else {
            const value = e.target.value;
            if (e.target.checked) {
                onChange && onChange([...checked, value]);
            }
            else {
                onChange && onChange(checked.filter((v) => v !== value));
            }
        }
    };
    return (React.createElement("div", { className: `form-control w-full ${className}` },
        React.createElement(FieldLabel, { htmlFor: name, label: label, required: required, helpText: helpText }),
        single ? (React.createElement("label", { className: "flex items-center gap-3 cursor-pointer py-1" },
            React.createElement("input", { type: "checkbox", name: name, value: "1", checked: checked.includes("1"), required: required, className: "checkbox checkbox-primary", onChange: handleChange, ...rest }),
            React.createElement("span", { className: "label-text" }, options[0]?.label || ""))) : (React.createElement("div", { className: `flex ${layout === "vertical" ? "flex-col" : "flex-wrap"} gap-4` }, options.map((option) => (React.createElement("label", { key: option.value, className: `flex items-center gap-3 cursor-pointer ${option.disabled ? "opacity-50" : ""}` },
            React.createElement("input", { type: "checkbox", name: name, value: option.value, checked: checked.includes(option.value), required: required, disabled: option.disabled, className: "checkbox checkbox-primary", onChange: handleChange, ...rest }),
            React.createElement("span", { className: "label-text" }, option.label)))))),
        error && (React.createElement("label", { className: "label" },
            React.createElement("span", { className: "label-text-alt text-error" }, error)))));
}
