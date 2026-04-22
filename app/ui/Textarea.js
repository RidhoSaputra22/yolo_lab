import React from "react";
import FieldLabel from "./FieldLabel.js";

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
export default function Textarea({
  label,
  placeholder = "",
  value = "",
  onChange,
  error = null,
  required = false,
  helpText = null,
  rows = 4,
  className = "",
  name,
  ...rest
}) {
  const textareaId = name || label || Math.random().toString(36).slice(2, 10);
  return (
    <div className={`form-control w-full ${className}`}>
      <FieldLabel htmlFor={textareaId} label={label} required={required} helpText={helpText} />
      <textarea
        id={textareaId}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        rows={rows}
        className={`textarea textarea-bordered w-full font-mono${error ? " textarea-error" : ""}`}
        {...rest}
      />
      {error && (
        <label className="label">
          <span className="label-text-alt text-error">{error}</span>
        </label>
      )}
    </div>
  );
}
