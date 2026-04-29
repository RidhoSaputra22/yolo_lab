import React from "react";
import { Card } from "../../ui.js";
import { FormFieldControl } from "../../components/FormFieldControl.jsx";

export function FootageExtractPanel({ layout, formValues, suggestions, onFieldChange }) {
  return (
    <Card className="rounded-md border border-base-300 bg-base-100/90 shadow-lg">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Extract Setup
          </p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            Atur frame step dan output extract
          </h3>
        </div>

        <div className="grid gap-3">
          {(layout || []).map((section) => (
            <details
              key={section.id}
              open
              className="rounded-md border border-base-300 bg-base-100/85"
            >
              <summary className="cursor-pointer list-none px-4 py-4">
                <p className="text-sm font-bold text-slate-900">{section.title}</p>
                <p className="mt-1 text-xs text-slate-500">{section.description}</p>
              </summary>
              <div className="grid gap-3 border-t border-base-300 px-4 py-4 sm:grid-cols-2">
                {(section.fields || []).map((field) => (
                  <FormFieldControl
                    key={field.name}
                    field={field}
                    value={formValues[field.name]}
                    suggestions={suggestions[field.name] || []}
                    onChange={onFieldChange}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </Card>
  );
}
