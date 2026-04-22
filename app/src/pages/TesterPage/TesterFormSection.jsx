import React from "react";
import { Alert, Badge, Card, Paragraph } from "../../ui.js";
import { formatCount } from "../../shared/utils.js";
import { FormFieldControl } from "../../components/FormFieldControl.jsx";

function matchesCondition(condition, formValues) {
  return Object.entries(condition || {}).every(([fieldName, expectedValue]) => {
    const currentValue = formValues[fieldName];
    if (Array.isArray(expectedValue)) {
      return expectedValue.includes(currentValue);
    }
    return currentValue === expectedValue;
  });
}

function isVisible(condition, formValues) {
  if (!condition) {
    return true;
  }
  if (Array.isArray(condition)) {
    return condition.some((item) => matchesCondition(item, formValues));
  }
  return matchesCondition(condition, formValues);
}

/**
 * Form configuration sections component for TesterPage
 */
export function TesterFormSection({
  layout,
  formValues,
  suggestions,
  onFieldChange,
}) {
  return (
    <div className="grid gap-3">
      {(layout || []).map((section) => {
        if (!isVisible(section.visibleWhen, formValues)) {
          return null;
        }

        const isYoloTuningSection = section.id === "yolo-tuning";
        const visibleFields = (section.fields || []).filter((field) => isVisible(field.visibleWhen, formValues));
        if (!visibleFields.length) {
          return null;
        }

        return (
          <details
            key={section.id}
            className="rounded-sm border border-base-300 bg-base-100/85"
            open={
              section.id === "source"
              || section.id === "yolo-tuning"
              || section.id === "model"
              || section.id === "employee-tracking"
            }
          >
            <summary className="cursor-pointer list-none px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                    {section.title}
                  </p>
                  <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                    {section.description}
                  </Paragraph>
                </div>
                <Badge type="ghost" className="px-3 py-3">
                  {formatCount(visibleFields.length, "field")}
                </Badge>
              </div>
            </summary>

            <div className="border-t border-base-300 px-5 py-5">
              <div className={section.id === "source" ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
                {visibleFields.map((field) => (
                  <div key={field.name}>
                    <FormFieldControl
                      field={field}
                      value={formValues[field.name]}
                      suggestions={suggestions[field.name] || []}
                      onChange={onFieldChange}
                    />
                  </div>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
