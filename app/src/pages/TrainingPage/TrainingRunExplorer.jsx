import React from "react";
import { Alert, Badge, Button, Card, Paragraph } from "../../ui.js";
import { formatCount, formatTimestamp, joinClasses } from "../../shared/utils.js";
import { formatMetric } from "../../shared/formHelpers.js";

/**
 * Training run explorer and detail view
 * Displays list of training runs and detailed metrics for selected run
 */
export function TrainingRunExplorer({
  runs,
  selectedRun,
  selectedRunKey,
  onSelectRun,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* Run list sidebar */}
      <Card className="h-fit rounded-sm border border-base-300 bg-base-100/90 shadow-xl xl:sticky xl:top-28">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
                Run Explorer
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">Hasil Training</h2>
              <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                Pilih run untuk melihat metric, weights, dan artifact utama.
              </Paragraph>
            </div>
            <Badge type="success" className="px-3 py-3">
              {formatCount(runs.length, "run")}
            </Badge>
          </div>

          <div className="grid gap-3">
            {runs.length ? (
              runs.map((run) => (
                <button
                  key={run.key}
                  type="button"
                  onClick={() => onSelectRun(run.key)}
                  className={joinClasses(
                    "w-full rounded-sm border p-4 text-left transition duration-150",
                    run.key === selectedRunKey
                      ? "border-warning bg-warning/10 shadow-md"
                      : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{run.key}</p>
                      <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-500">
                        {run.path}
                      </p>
                    </div>
                    <Badge
                      type={run.key === selectedRunKey ? "warning" : "ghost"}
                      className="shrink-0 px-3 py-2"
                    >
                      {run.metrics?.lastEpoch ? `ep ${run.metrics.lastEpoch}` : run.fileCount}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    <div>
                      <p className="uppercase tracking-[0.18em] text-slate-400">Size</p>
                      <p className="mt-1 font-medium text-slate-600">{run.totalSizeLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="uppercase tracking-[0.18em] text-slate-400">Updated</p>
                      <p className="mt-1 font-medium text-slate-600">{formatTimestamp(run.updatedAt)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="uppercase tracking-[0.18em] text-slate-400">mAP50-95</p>
                      <p className="mt-1 font-medium text-slate-500">
                        {formatMetric(run.metrics?.bestMap50_95, { percent: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <Alert type="info" className="rounded-sm text-sm">
                Belum ada run training di folder output.
              </Alert>
            )}
          </div>
        </div>
      </Card>

      {/* Run details card */}
      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-xl">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
                Detail Run
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">
                {selectedRun ? selectedRun.key : "Belum ada run"}
              </h2>
              <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                Metrik terakhir, konfigurasi inti, dan artifact penting dari training.
              </Paragraph>
            </div>
            {selectedRun ? (
              <Badge type="info" className="px-3 py-3">
                {selectedRun.totalSizeLabel}
              </Badge>
            ) : null}
          </div>

          {selectedRun ? (
            <>
              {/* Metrics grid */}
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { label: "Precision", value: formatMetric(selectedRun.metrics?.lastPrecision, { percent: true }) },
                  { label: "Recall", value: formatMetric(selectedRun.metrics?.lastRecall, { percent: true }) },
                  { label: "mAP50", value: formatMetric(selectedRun.metrics?.bestMap50, { percent: true }) },
                  {
                    label: "mAP50-95",
                    value: formatMetric(selectedRun.metrics?.bestMap50_95, { percent: true }),
                    tone: "text-success",
                  },
                ].map(({ label, value, tone }) => (
                  <div
                    key={label}
                    className={`rounded-sm border border-base-300 bg-base-200/40 p-3 ${tone || ""}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* Training config grid */}
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  {
                    label: "Epoch",
                    value: String(selectedRun.metrics?.lastEpoch ?? "-"),
                    detail: `${selectedRun.metrics?.rowCount ?? 0} row`,
                  },
                  {
                    label: "Batch",
                    value: String(selectedRun.config?.batch ?? "-"),
                    detail: `workers ${selectedRun.config?.workers ?? "-"}`,
                  },
                  {
                    label: "Image",
                    value: String(selectedRun.config?.imgsz ?? "-"),
                    detail: `device ${selectedRun.config?.device ?? "-"}`,
                  },
                  {
                    label: "Patience",
                    value: String(selectedRun.config?.patience ?? "-"),
                    detail: `epochs ${selectedRun.config?.epochs ?? "-"}`,
                  },
                ].map(({ label, value, detail }) => (
                  <div key={label} className="rounded-sm border border-base-300 bg-base-200/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
                    {detail ? <p className="mt-1 text-[11px] text-slate-500">{detail}</p> : null}
                  </div>
                ))}
              </div>

              {/* Model and data config */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-sm border border-base-300 bg-base-200/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Model
                  </p>
                  <p className="mt-2 break-all font-mono text-[12px] text-slate-900">
                    {selectedRun.config?.model || "-"}
                  </p>
                </div>
                <div className="rounded-sm border border-base-300 bg-base-200/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Data
                  </p>
                  <p className="mt-2 break-all font-mono text-[12px] text-slate-900">
                    {selectedRun.config?.data || "-"}
                  </p>
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex flex-wrap gap-2">
                {selectedRun.artifacts?.bestWeights?.downloadUrl ? (
                  <a
                    href={selectedRun.artifacts.bestWeights.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm bg-warning px-4 py-2 text-sm font-semibold text-white hover:bg-warning/90"
                  >
                    Best Weights
                  </a>
                ) : null}
                {selectedRun.artifacts?.lastWeights?.downloadUrl ? (
                  <a
                    href={selectedRun.artifacts.lastWeights.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold hover:bg-base-200"
                  >
                    Last Weights
                  </a>
                ) : null}
                {selectedRun.artifacts?.resultsCsv?.downloadUrl ? (
                  <a
                    href={selectedRun.artifacts.resultsCsv.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90"
                  >
                    results.csv
                  </a>
                ) : null}
                {selectedRun.artifacts?.argsYaml?.downloadUrl ? (
                  <a
                    href={selectedRun.artifacts.argsYaml.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold hover:bg-base-200"
                  >
                    args.yaml
                  </a>
                ) : null}
              </div>

              {/* Preview artifacts */}
              {(selectedRun.previewArtifacts || []).length ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {selectedRun.previewArtifacts.map((artifact) => (
                    <article
                      key={artifact.path}
                      className="overflow-hidden rounded-sm border border-base-300 bg-base-100 shadow-md"
                    >
                      <div className="border-b border-base-300 bg-slate-950">
                        <img
                          src={artifact.downloadUrl}
                          alt={artifact.name}
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-semibold text-slate-900">{artifact.name}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{artifact.sizeLabel}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Alert type="info" className="rounded-sm text-sm">
                  Run ini belum memiliki artifact preview gambar.
                </Alert>
              )}
            </>
          ) : (
            <Alert type="info" className="rounded-sm text-sm">
              Belum ada detail run yang bisa ditampilkan.
            </Alert>
          )}
        </div>
      </Card>
    </div>
  );
}
