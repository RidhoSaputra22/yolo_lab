import React, { useState } from "react";
import FieldLabel from "./FieldLabel.js";

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
export default function Select({
  label,
  options = [],
  value = "",
  onChange,
  placeholder = "Pilih...",
  error = null,
  required = false,
  helpText = null,
  searchable = false,
  searchPlaceholder = "Cari...",
  className = "",
  name,
  ...rest
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const selectId = name || label || Math.random().toString(36).slice(2, 10);
  const filteredOptions = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : options;

  return (
    <div className={`form-control w-full ${className}`}>
      <FieldLabel htmlFor={selectId} label={label} required={required} helpText={helpText} />
      {searchable && (
        <input
          type="text"
          className="input input-bordered input-sm mb-2"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`select select-bordered w-full${error ? " select-error" : ""}`}
        {...rest}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {filteredOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <label className="label">
          <span className="label-text-alt text-error">{error}</span>
        </label>
      )}
    </div>
  );
}
