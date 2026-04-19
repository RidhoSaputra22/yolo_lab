import React from "react";
import { Checkbox, Input, Paragraph, Select, Textarea } from "../ui.js";
import { PathInput } from "./PathInput.jsx";
import { fieldValueToString } from "../shared/formHelpers.js";

/**
 * Generic form field control component
 * Renders different input types based on field configuration
 */
export function FormFieldControl({ field, value, suggestions, onChange }) {
  if (field.type === "bool") {
    return (
      <div className="rounded-sm border border-base-300 bg-base-100/80 p-4">
        <Checkbox
          single
          name={field.name}
          options={[{ value: "1", label: field.label }]}
          checked={value ? ["1"] : []}
          onChange={(next) => onChange(field.name, next.includes("1"))}
        />
        {field.helpText ? (
          <Paragraph className="mt-2 text-xs leading-5">{field.helpText}</Paragraph>
        ) : null}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <Textarea
          name={field.name}
          label={field.label}
          rows={4}
          placeholder={field.placeholder || ""}
          value={fieldValueToString(value)}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
        {field.helpText ? (
          <Paragraph className="mt-2 text-xs leading-5">{field.helpText}</Paragraph>
        ) : null}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Select
        name={field.name}
        label={field.label}
        value={fieldValueToString(value)}
        onChange={(event) => onChange(field.name, event.target.value)}
        options={(field.choices || []).map((choice) => ({ value: choice, label: choice }))}
        placeholder="Pilih..."
      />
    );
  }

  if (field.type === "path") {
    return (
      <PathInput
        name={field.name}
        label={field.label}
        value={fieldValueToString(value)}
        suggestions={suggestions}
        onChange={(newValue) => onChange(field.name, newValue)}
        required={Boolean(field.required)}
        helpText={field.helpText || null}
        placeholder={field.placeholder || ""}
      />
    );
  }

  return (
    <Input
      name={field.name}
      label={field.label}
      type={field.type === "int" || field.type === "float" ? "number" : "text"}
      step={field.type === "float" ? "0.01" : field.type === "int" ? "1" : undefined}
      required={Boolean(field.required)}
      helpText={field.helpText || null}
      placeholder={field.placeholder || ""}
      value={fieldValueToString(value)}
      onChange={(event) => onChange(field.name, event.target.value)}
    />
  );
}
