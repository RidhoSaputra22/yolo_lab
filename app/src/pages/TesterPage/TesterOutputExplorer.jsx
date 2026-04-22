import React, { useEffect, useState } from "react";
import { Alert, Badge, Card, Button, Paragraph } from "../../ui.js";
import { formatCount, joinClasses } from "../../shared/utils.js";

function formatMetric(value, { percent = false, digits = 1 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  if (percent) {
    return `${(parsed * 100).toFixed(digits)}%`;
  }
  return parsed.toFixed(digits);
}

function SummaryMetrics({ summaryData }) {
  const benchmark = summaryData?.face_benchmark;
  const faceRegistry = summaryData?.face_registry;

  if (!benchmark && !faceRegistry) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {benchmark ? (
        <div className="rounded-sm border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Face Benchmark
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Evaluasi pengenalan petugas dari folder wajah berlabel nama file.
              </p>
            </div>
            <Badge type="success" className="px-3 py-3">
              {formatMetric(benchmark.accuracy, { percent: true })}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              ["Akurasi", formatMetric(benchmark.accuracy, { percent: true })],
              ["Benar", benchmark.correct_predictions ?? 0],
              ["Salah", benchmark.wrong_predictions ?? 0],
              ["Unknown", benchmark.unknown_predictions ?? 0],
              ["Label", benchmark.label_count ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-emerald-200 bg-white/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {[
              ["Gambar diproses", benchmark.usable_images ?? 0],
              ["Tanpa wajah", benchmark.images_without_face ?? 0],
              ["Self-match", benchmark.allow_self_match ? "aktif" : "nonaktif"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-emerald-200 bg-white/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {faceRegistry ? (
        <div className="rounded-sm border border-base-300 bg-base-200/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Registry Wajah
            </p>
            <Badge type="warning" className="px-3 py-3">
              {faceRegistry.source || "-"}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["Identitas", faceRegistry.loaded_count ?? faceRegistry.registry_size ?? 0],
              ["Sampel", faceRegistry.sample_count ?? faceRegistry.image_count ?? 0],
              ["Skip no face", faceRegistry.skipped_no_face ?? 0],
              ["Skip error", faceRegistry.skipped_read_error ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-base-300 bg-base-100/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RunVideoPreview({ run }) {
  const benchmark = run.summary?.summaryData?.face_benchmark;
  const initialPlaybackError =
    run.video?.videoPlayback && run.video.videoPlayback.playable === false
      ? run.video.videoPlayback.issue
      : "";
  const [playbackError, setPlaybackError] = useState(initialPlaybackError);

  useEffect(() => {
    setPlaybackError(
      run.video?.videoPlayback && run.video.videoPlayback.playable === false
        ? run.video.videoPlayback.issue
        : "",
    );
  }, [run.video?.path, run.video?.videoPlayback?.playable, run.video?.videoPlayback?.issue]);

  if (benchmark) {
    return (
      <div className="grid aspect-video place-items-center border-b border-base-300 bg-emerald-950 px-6 text-center">
        <div className="max-w-xl space-y-3">
          <p className="text-base font-semibold text-emerald-100">Benchmark face recognition</p>
          <p className="text-sm leading-6 text-emerald-50/80">
            Akurasi {formatMetric(benchmark.accuracy, { percent: true })} dari {benchmark.usable_images || 0} gambar yang berhasil diproses.
          </p>
        </div>
      </div>
    );
  }

  if (!run.video?.downloadUrl) {
    return (
      <div className="grid aspect-video place-items-center border-b border-base-300 bg-slate-950 px-4 text-center text-sm text-slate-400">
        File video belum tersedia untuk run ini.
      </div>
    );
  }

  if (playbackError) {
    return (
      <div className="grid aspect-video place-items-center border-b border-base-300 bg-slate-950 px-6 text-center">
        <div className="max-w-xl space-y-3">
          <p className="text-base font-semibold text-slate-100">Video belum bisa diputar di browser</p>
          <p className="text-sm leading-6 text-slate-400">{playbackError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-base-300 bg-slate-950">
      <video
        className="aspect-video w-full bg-slate-950"
        controls
        preload="metadata"
        onError={() =>
          setPlaybackError(
            "Browser gagal memutar video ini. Codec video mungkin tidak didukung atau file output belum final.",
          )
        }
      >
        <source src={run.video.downloadUrl} type="video/mp4" />
      </video>
    </div>
  );
}

/**
 * Output explorer and results viewer for TesterPage
 */
export function TesterOutputExplorer({
  folders,
  selectedFolderKey,
  selectedFolder,
  job,
  onSelectFolder,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-xl">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
                Output Explorer
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">Folder Output</h2>
              <Paragraph className="mt-2 text-sm leading-6 opacity-100">
                Pilih folder untuk melihat run video hasil test.
              </Paragraph>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge type="success" className="px-3 py-3">
                {formatCount(folders.length, "folder")}
              </Badge>
              <Badge type="warning" className="px-3 py-3">
                {formatCount((job?.artifacts || []).length, "file")}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3">
            {folders.length ? (
              folders.map((folder) => (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => onSelectFolder(folder.key)}
                  className={joinClasses(
                    "rounded-sm border p-4 text-left transition duration-150",
                    folder.key === selectedFolderKey
                      ? "border-success bg-success/10 shadow-md"
                      : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{folder.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{folder.path}</p>
                    </div>
                    <Badge type={folder.key === selectedFolderKey ? "success" : "ghost"} className="px-3 py-3">
                      {folder.runCount}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>{formatCount(folder.fileCount, "file")}</span>
                    <span>{folder.totalSizeLabel}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{folder.updatedAt}</p>
                </button>
              ))
            ) : (
              <Alert type="info" className="rounded-sm text-sm">
                Belum ada folder output yang berisi artifact.
              </Alert>
            )}
          </div>
        </div>
      </Card>

      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-xl">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
                Hasil Per Run
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">
                {selectedFolder ? selectedFolder.label : "Belum ada folder"}
              </h2>
            </div>
            {selectedFolder ? (
              <Badge type="info" className="px-3 py-3">
                {selectedFolder.totalSizeLabel}
              </Badge>
            ) : null}
          </div>

          {selectedFolder ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Run", formatCount(selectedFolder.runCount, "run")],
                  ["File", formatCount(selectedFolder.fileCount, "file")],
                  ["Updated", selectedFolder.updatedAt],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-sm border border-base-300 bg-base-200/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4">
                {selectedFolder.runs.length ? (
                  selectedFolder.runs.map((run) => {
                    const isBenchmarkRun = run.summary?.summaryData?.test_mode === "face-benchmark";
                    const csvLabel = isBenchmarkRun ? "Predictions CSV" : "Tracks CSV";

                    return (
                      <article
                        key={run.key}
                        className="overflow-hidden rounded-sm border border-base-300 bg-base-100 shadow-md"
                      >
                      <RunVideoPreview run={run} />

                      <div className="grid gap-4 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{run.key}</h3>
                            <Paragraph className="mt-1 text-xs opacity-100">
                              {selectedFolder.label} • {run.updatedAt}
                            </Paragraph>
                          </div>
                          <Badge type="ghost" className="px-3 py-3">
                            {run.totalSizeLabel}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge
                            type={
                              run.video?.videoPlayback?.playable === false
                                ? "warning"
                                : run.video
                                  ? "success"
                                  : "ghost"
                            }
                            className="px-3 py-3"
                          >
                            {run.video?.videoPlayback?.playable === false
                              ? "Video belum final"
                              : run.video
                                ? "Video"
                                : "Tanpa video"}
                          </Badge>
                          {run.summary ? (
                            <Badge type="warning" className="px-3 py-3">
                              Summary JSON
                            </Badge>
                          ) : null}
                          {run.tracks ? (
                            <Badge type="info" className="px-3 py-3">
                              {csvLabel}
                            </Badge>
                          ) : null}
                          {run.others.length ? (
                            <Badge type="ghost" className="px-3 py-3">
                              +{run.others.length} file
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {run.video?.downloadUrl ? (
                            <Button
                              href={run.video.downloadUrl}
                              variant="primary"
                              isSubmit={false}
                              className="rounded-sm"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Buka video
                            </Button>
                          ) : null}
                          {run.summary?.downloadUrl ? (
                            <Button
                              href={run.summary.downloadUrl}
                              variant="warning"
                              isSubmit={false}
                              className="rounded-sm"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Summary JSON
                            </Button>
                          ) : null}
                          {run.tracks?.downloadUrl ? (
                            <Button
                              href={run.tracks.downloadUrl}
                              variant="info"
                              isSubmit={false}
                              className="rounded-sm"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {csvLabel}
                            </Button>
                          ) : null}
                          {run.others.map((artifact, index) => (
                            <Button
                              key={artifact.path}
                              href={artifact.downloadUrl}
                              variant="ghost"
                              isSubmit={false}
                              className="rounded-sm border border-base-300 bg-base-100"
                              target="_blank"
                              rel="noreferrer"
                            >
                              File {index + 1}
                            </Button>
                          ))}
                        </div>

                        <SummaryMetrics summaryData={run.summary?.summaryData} />
                      </div>
                    </article>
                    );
                  })
                ) : (
                  <Alert type="info" className="rounded-sm text-sm">
                    Folder ini belum memiliki run yang bisa dirangkum.
                  </Alert>
                )}
              </div>
            </>
          ) : (
            <Alert type="info" className="rounded-sm text-sm">
              Belum ada hasil test yang bisa ditampilkan.
            </Alert>
          )}
        </div>
      </Card>
    </div>
  );
}
