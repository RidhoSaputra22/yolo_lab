import React from "react";
import { Alert, Badge, Card, Paragraph } from "../../ui.js";
import { formatCount } from "../../shared/utils.js";
import { FormFieldControl } from "../../components/FormFieldControl.jsx";

/**
 * Training command preview and configuration panel
 * Shows form fields and renders command preview
 */
export function TrainingCommandPanel({
  layout,
  formValues,
  suggestions,
  preview,
  previewError,
  previewState,
  presetSummary,
  onFieldChange,
}) {
  const previewBadge = {
    idle: { type: "ghost", label: "menunggu" },
    loading: { type: "info", label: "memuat" },
    ready: { type: "success", label: "sinkron" },
    error: { type: "error", label: "error" },
  }[previewState];

  return (
    <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
            Command Preview
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Preview Prepare + Training
          </h2>
          <Paragraph className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 opacity-100">
            Form ini menjalankan `prepare-train` dari `yolo_train.py`: bangun dataset dari
            label aktif, lalu langsung train model tanpa auto-label ulang.
          </Paragraph>
        </div>
        <Badge type={previewBadge.type} className="self-start px-3 py-3">
          {previewBadge.label}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Form sections */}
        <div className="grid gap-3">
          {(layout || []).map((section) => (
            <details
              key={section.id}
              className="rounded-sm border border-base-300 bg-base-100/85"
              open={section.id === "dataset" || section.id === "training"}
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
                    {formatCount((section.fields || []).length, "field")}
                  </Badge>
                </div>
              </summary>

              <div className="border-t border-base-300 px-5 py-5">
                <div className={section.columns === 1 ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
                  {(section.fields || []).map((field) => (
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
          ))}
        </div>

        {/* Command preview + preset summary */}
        <div className="grid gap-4">
          {/* Command display */}
          <Card className="rounded-sm border border-base-300 bg-slate-950 text-slate-100 shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">Command</h3>
                <Badge type={previewBadge.type} className="border-none px-3 py-3">
                  {previewBadge.label}
                </Badge>
              </div>
              <pre className="max-h-[320px] overflow-auto rounded-sm bg-slate-900/70 p-4 text-xs leading-6 text-slate-100">
                {previewError ||
                  preview?.commandDisplay ||
                  "Isi form konfigurasi untuk melihat command training."}
              </pre>
            </div>
          </Card>

          {/* Preset summary */}
          <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-lg">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold">Preset Penting</h3>
                <Badge type="warning" className="px-3 py-3">
                  Label aman
                </Badge>
              </div>
              <div className="grid gap-3">
                {presetSummary.map(([label, value]) => (
                  <div key={label} className="rounded-sm border border-base-300 bg-base-200/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 break-all font-mono text-[12px] text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  );
}
