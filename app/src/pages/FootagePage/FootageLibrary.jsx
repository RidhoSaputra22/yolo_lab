import React from "react";
import { Alert, Badge, Button, Card } from "../../ui.js";
import { formatTimestamp, joinClasses } from "../../shared/utils.js";

export function FootageLibrary({
  library,
  selectedFootage,
  selectedFootagePath,
  onSelectFootage,
  onOpenLabeler,
}) {
  const footageItems = library?.footageItems || [];
  const framePreview = library?.framePreview || [];

  return (
    <div className="grid gap-4">
      <Card className="rounded-md border border-base-300 bg-base-100/90 shadow-lg">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Footage Preview
              </p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                Preview video di `train/footage`
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge type="info" className="px-3 py-3">
                {library?.totalFootageSizeLabel || "-"}
              </Badge>
              <Badge type="ghost" className="px-3 py-3">
                {footageItems.length} video
              </Badge>
            </div>
          </div>

          {!footageItems.length ? (
            <Alert type="info" className="rounded-md text-sm">
              Belum ada footage di folder ini. Import video dulu, lalu jalankan ekstraksi frame.
            </Alert>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
                {footageItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className={joinClasses(
                      "rounded-md border p-3 text-left transition",
                      item.path === selectedFootagePath
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-base-300 bg-base-100 hover:border-primary hover:bg-primary/5",
                    )}
                    onClick={() => onSelectFootage(item.path)}
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.sizeLabel}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge type="info" className="px-2 py-1">
                        {item.extractedFrames} frame
                      </Badge>
                      <Badge type={item.labeledFrames > 0 ? "success" : "ghost"} className="px-2 py-1">
                        {item.labeledFrames} labeled
                      </Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      update {formatTimestamp(item.modifiedAt)}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid gap-4">
                <div className="overflow-hidden rounded-md border border-base-300 bg-slate-950 shadow-xl">
                  {selectedFootage?.previewUrl ? (
                    <video
                      key={selectedFootage.previewUrl}
                      src={selectedFootage.previewUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-black object-contain"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-slate-300">
                      Preview video belum tersedia.
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["Nama", selectedFootage?.name || "-"],
                    ["Path", selectedFootage?.path || "-"],
                    ["Frames hasil extract", String(selectedFootage?.extractedFrames ?? "-")],
                    ["Frames berlabel", String(selectedFootage?.labeledFrames ?? "-")],
                    ["Ukuran file", selectedFootage?.sizeLabel || "-"],
                    ["Update", formatTimestamp(selectedFootage?.modifiedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-base-300 bg-base-200/50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 break-all font-mono text-[12px] text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-md border border-base-300 bg-base-100/90 shadow-lg">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Dataset Preview
              </p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                Cuplikan frame hasil extract
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge type="success" className="px-3 py-3">
                {library?.labeledFrameCount ?? 0} labeled
              </Badge>
              <Badge type="warning" className="px-3 py-3">
                {library?.pendingFrameCount ?? 0} pending
              </Badge>
            </div>
          </div>

          {!framePreview.length ? (
            <Alert type="info" className="rounded-md text-sm">
              Belum ada frame hasil extract. Setelah extract berjalan, preview frame akan tampil di sini.
            </Alert>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {framePreview.map((frame) => (
                <div
                  key={frame.name}
                  className="overflow-hidden rounded-md border border-base-300 bg-base-100 shadow-md"
                >
                  <img
                    src={frame.imageUrl}
                    alt={frame.name}
                    className="aspect-video w-full bg-base-200 object-cover"
                    loading="lazy"
                  />
                  <div className="space-y-3 p-3">
                    <div>
                      <p className="truncate text-sm font-semibold text-slate-900">{frame.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        sumber: {frame.sourceStem || "-"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge type={frame.hasLabelFile ? "success" : "ghost"} className="px-2 py-1">
                        {frame.hasLabelFile ? `${frame.boxCount} box` : "belum dilabel"}
                      </Badge>
                      <Badge type="info" className="px-2 py-1">
                        {formatTimestamp(frame.modifiedAt)}
                      </Badge>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        isSubmit={false}
                        className="rounded-md border border-base-300 px-4"
                        onClick={onOpenLabeler}
                      >
                        Buka Labeler
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
