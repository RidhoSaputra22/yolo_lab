import React from "react";
import { Alert, Badge, Card } from "../../ui.js";
import { formatCount, formatTimestamp } from "../../shared/utils.js";

/**
 * Command preview and job summary panel for TesterPage
 */
export function TesterCommandPanel({
  preview,
  previewError,
  previewState,
  job,
  defaults,
}) {
  const previewBadge = {
    idle: { type: "ghost", label: "menunggu" },
    loading: { type: "info", label: "memuat" },
    ready: { type: "success", label: "sinkron" },
    error: { type: "error", label: "error" },
  }[previewState] || { type: "ghost", label: "menunggu" };

  return (
    <div className="grid gap-4">
      <Card className="rounded-sm border border-base-300 bg-slate-950 text-slate-100 shadow-lg">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Command</h3>
            <Badge type={previewBadge.type} className="border-none px-3 py-3">
              {previewBadge.label}
            </Badge>
          </div>
          <pre className="max-h-[260px] overflow-auto rounded-sm bg-slate-900/70 p-4 text-xs leading-6 text-slate-100">
            {previewError ||
              preview?.commandDisplay ||
              "Isi form konfigurasi untuk melihat command runner."}
          </pre>
        </div>
      </Card>

      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-lg">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Ringkasan Job</h3>
            <Badge type={job?.error ? "error" : "ghost"} className="px-3 py-3">
              {formatCount((job?.artifacts || []).length, "artifact")}
            </Badge>
          </div>
          {job?.error ? (
            <Alert type="error" className="rounded-sm text-sm">
              {job.error}
            </Alert>
          ) : null}
          <div className="grid gap-3">
            {[
              ["Started", formatTimestamp(job?.startedAt)],
              ["Finished", formatTimestamp(job?.finishedAt)],
              ["Output Dir", job?.outputDir || defaults.outputDir || "-"],
              ["Command", job?.commandDisplay || "-"],
            ].map(([label, value]) => (
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
  );
}
