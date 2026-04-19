import React from "react";
import { Alert, Badge, Card } from "../../ui.js";
import { formatTimestamp } from "../../shared/utils.js";

export function FootageCommandPanel({
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
    <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Command Preview
            </p>
            <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
              Preview command ekstraksi
            </h3>
          </div>
          <Badge type={previewBadge.type} className="px-3 py-3">
            {previewBadge.label}
          </Badge>
        </div>

        {previewError ? (
          <Alert type="error" className="rounded-sm text-sm">
            {previewError}
          </Alert>
        ) : null}

        {job?.error ? (
          <Alert type="error" className="rounded-sm text-sm">
            {job.error}
          </Alert>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-sm border border-base-300 bg-slate-950 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Command
            </p>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-100">
              {preview?.commandDisplay || "-"}
            </pre>
          </div>

          <div className="grid gap-3">
            {[
              ["Footage dir", preview?.config?.footageDir || defaults.footageDir || "-"],
              ["Frames dir", preview?.config?.framesDir || defaults.framesDir || "-"],
              [
                "Estimated frames",
                String(preview?.config?.estimatedFrameCount ?? defaults.estimatedFrameCount ?? "-"),
              ],
              ["Frame step", String(preview?.config?.sampleEvery ?? defaults.sampleEvery ?? "-")],
              [
                "Max per video",
                String(preview?.config?.maxFramesPerVideo ?? defaults.maxFramesPerVideo ?? "-"),
              ],
              ["JPEG quality", String(preview?.config?.jpegQuality ?? defaults.jpegQuality ?? "-")],
              ["Started", formatTimestamp(job?.startedAt)],
              ["Finished", formatTimestamp(job?.finishedAt)],
              ["Output dir", job?.outputDir || preview?.config?.framesDir || defaults.framesDir || "-"],
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
      </div>
    </Card>
  );
}
