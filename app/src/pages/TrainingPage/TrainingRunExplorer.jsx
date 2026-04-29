import React from "react";
import { Alert, Badge, Button, Card, Modal, Paragraph } from "../../ui.js";
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
  const [isAssetModalOpen, setIsAssetModalOpen] = React.useState(false);
  const [activeImageIndex, setActiveImageIndex] = React.useState(-1);

  const imageArtifacts = React.useMemo(
    () => selectedRun?.imageArtifacts || selectedRun?.previewArtifacts || [],
    [selectedRun],
  );

  const activeImageArtifact =
    activeImageIndex >= 0 && activeImageIndex < imageArtifacts.length
      ? imageArtifacts[activeImageIndex]
      : null;

  const closeAssetGallery = () => {
    setIsAssetModalOpen(false);
    setActiveImageIndex(-1);
  };

  const showPreviousImage = () => {
    if (!imageArtifacts.length) {
      return;
    }
    setActiveImageIndex((current) => (current <= 0 ? imageArtifacts.length - 1 : current - 1));
  };

  const showNextImage = () => {
    if (!imageArtifacts.length) {
      return;
    }
    setActiveImageIndex((current) => (current >= imageArtifacts.length - 1 ? 0 : current + 1));
  };

  React.useEffect(() => {
    setActiveImageIndex(-1);
  }, [selectedRunKey]);

  React.useEffect(() => {
    if (!activeImageArtifact || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveImageIndex(-1);
        return;
      }

      if (imageArtifacts.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeImageArtifact, imageArtifacts.length]);

  return (
    <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Run list sidebar */}
        <Card className="h-fit min-w-0 rounded-md border border-base-300 bg-base-100/90 shadow-xl xl:sticky xl:top-28">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
                  Run Explorer
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight">Hasil Training</h2>
                <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                  Pilih run untuk membuka detail lengkap di panel kanan.
                </Paragraph>
              </div>
              <Badge type="success" className="px-3 py-3">
                {formatCount(runs.length, "run")}
              </Badge>
            </div>

            <div className="grid gap-2 overflow-auto">
              {runs.length ? (
                runs.map((run) => (
                  <button
                    key={run.key}
                    type="button"
                    onClick={() => onSelectRun(run.key)}
                    className={joinClasses(
                      "w-full overflow-hidden rounded-md border px-3 py-3 text-left transition duration-150",
                      run.key === selectedRunKey
                        ? "border-warning bg-warning/10 shadow-md"
                        : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20",
                    )}
                    title={run.key}
                  >
                    <p className="text-wrap-anywhere text-sm font-semibold leading-5 text-slate-900">
                      {run.key}
                    </p>
                  </button>
                ))
              ) : (
                <Alert type="info" className="rounded-md text-sm">
                  Belum ada run training di folder output.
                </Alert>
              )}
            </div>
          </div>
        </Card>

        {/* Run details card */}
        <Card className="min-w-0 rounded-md border border-base-300 bg-base-100/90 shadow-xl">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
                  Detail Run
                </p>
                <h2 className="text-wrap-anywhere mt-2 text-xl font-bold tracking-tight">
                  {selectedRun ? selectedRun.key : "Belum ada run"}
                </h2>
                <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                  Metrik terakhir, konfigurasi inti, dan artifact penting dari training.
                </Paragraph>
              </div>
              {selectedRun ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    isSubmit={false}
                    size="sm"
                    className="rounded-md border border-base-300 bg-base-100 px-4"
                    disabled={!imageArtifacts.length}
                    onClick={() => setIsAssetModalOpen(true)}
                  >
                    Asset ({imageArtifacts.length})
                  </Button>
                  <Badge type="info" className="px-3 py-3">
                    {selectedRun.totalSizeLabel}
                  </Badge>
                </div>
              ) : null}
            </div>

            {selectedRun ? (
              <>
                {/* Run summary moved from sidebar */}
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border border-base-300 bg-base-200/40 p-3 md:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Path
                    </p>
                    <p className="text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900">
                      {selectedRun.path || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-base-300 bg-base-200/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Updated
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {formatTimestamp(selectedRun.updatedAt)}
                    </p>
                  </div>
                  <div className="rounded-md border border-base-300 bg-base-200/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Artifact
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {formatCount(selectedRun.fileCount ?? 0, "file")}
                    </p>
                  </div>
                </div>

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
                      className={`rounded-md border border-base-300 bg-base-200/40 p-3 ${tone || ""}`}
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
                    <div key={label} className="rounded-md border border-base-300 bg-base-200/40 p-3">
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
                  <div className="rounded-md border border-base-300 bg-base-200/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Model
                    </p>
                    <p className="text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900">
                      {selectedRun.config?.model || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-base-300 bg-base-200/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Data
                    </p>
                    <p className="text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900">
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
                      className="rounded-md bg-warning px-4 py-2 text-sm font-semibold text-white hover:bg-warning/90"
                    >
                      Best Weights
                    </a>
                  ) : null}
                  {selectedRun.artifacts?.lastWeights?.downloadUrl ? (
                    <a
                      href={selectedRun.artifacts.lastWeights.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold hover:bg-base-200"
                    >
                      Last Weights
                    </a>
                  ) : null}
                  {selectedRun.artifacts?.resultsCsv?.downloadUrl ? (
                    <a
                      href={selectedRun.artifacts.resultsCsv.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90"
                    >
                      results.csv
                    </a>
                  ) : null}
                  {selectedRun.artifacts?.argsYaml?.downloadUrl ? (
                    <a
                      href={selectedRun.artifacts.argsYaml.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold hover:bg-base-200"
                    >
                      args.yaml
                    </a>
                  ) : null}
                </div>

                {/* Preview artifacts */}
                {(selectedRun.previewArtifacts || []).length ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {selectedRun.previewArtifacts.map((artifact) => {
                      const previewIndex = imageArtifacts.findIndex((item) => item.path === artifact.path);
                      return (
                        <button
                          key={artifact.path}
                          type="button"
                          disabled={previewIndex < 0}
                          onClick={() => setActiveImageIndex(previewIndex)}
                          className="overflow-hidden rounded-md border border-base-300 bg-base-100 text-left shadow-md transition hover:-translate-y-0.5 hover:border-base-content/20 disabled:cursor-default disabled:hover:translate-y-0"
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
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Alert type="info" className="rounded-md text-sm">
                    Run ini belum memiliki artifact preview gambar.
                  </Alert>
                )}
              </>
            ) : (
              <Alert type="info" className="rounded-md text-sm">
                Belum ada detail run yang bisa ditampilkan.
              </Alert>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={isAssetModalOpen}
        onClose={closeAssetGallery}
        title={selectedRun ? `Asset Run - ${selectedRun.key}` : "Asset Run"}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-base-300 bg-base-200/30 p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Asset Gallery
              </p>
              <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                Klik thumbnail untuk membuka preview fullscreen dari artifact gambar.
              </Paragraph>
            </div>
            <Badge type="info" className="px-3 py-2">
              {formatCount(imageArtifacts.length, "image")}
            </Badge>
          </div>

          {imageArtifacts.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {imageArtifacts.map((artifact, index) => (
                <button
                  key={artifact.path}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className="group overflow-hidden rounded-md border border-base-300 bg-base-100 text-left shadow-md transition duration-150 hover:-translate-y-0.5 hover:border-base-content/20"
                >
                  <div className="overflow-hidden border-b border-base-300 bg-slate-950">
                    <img
                      src={artifact.downloadUrl}
                      alt={artifact.name}
                      className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{artifact.name}</p>
                    <p className="text-[11px] text-slate-500">{artifact.sizeLabel}</p>
                    <p className="text-[11px] text-slate-500">{formatTimestamp(artifact.modifiedAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Alert type="info" className="rounded-md text-sm">
              Run ini belum memiliki asset gambar yang bisa ditampilkan.
            </Alert>
          )}
        </div>
      </Modal>

      {activeImageArtifact ? (
        <div
          className="fixed inset-0 z-[1200] bg-slate-950/95 p-4 md:p-6"
          onClick={() => setActiveImageIndex(-1)}
        >
          <div className="flex h-full flex-col gap-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">
                  Asset Preview
                </p>
                <h3 className="text-wrap-anywhere mt-2 text-xl font-bold">
                  {activeImageArtifact.name}
                </h3>
                <p className="mt-2 text-xs text-slate-300">
                  {activeImageArtifact.sizeLabel} • {formatTimestamp(activeImageArtifact.modifiedAt)} •{" "}
                  {activeImageIndex + 1}/{imageArtifacts.length}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {imageArtifacts.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                      onClick={showPreviousImage}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                      onClick={showNextImage}
                    >
                      Next
                    </button>
                  </>
                ) : null}
                <a
                  href={activeImageArtifact.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Buka Tab Baru
                </a>
                <button
                  type="button"
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  onClick={() => setActiveImageIndex(-1)}
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md border border-white/10 bg-black/40 p-3 md:p-6">
              <img
                src={activeImageArtifact.downloadUrl}
                alt={activeImageArtifact.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
