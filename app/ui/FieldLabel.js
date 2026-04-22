import React from "react";
import HelpTooltip from "./HelpTooltip.js";

export default function FieldLabel({
  htmlFor,
  label,
  required = false,
  helpText = null,
  className = "",
}) {
  if (!label) {
    return null;
  }

  return (
    <div className={`label justify-start gap-2 ${className}`.trim()}>
      <label className="label-text cursor-pointer font-medium" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-error">*</span> : null}
      </label>
      <HelpTooltip label={label} text={helpText} />
    </div>
  );
}
