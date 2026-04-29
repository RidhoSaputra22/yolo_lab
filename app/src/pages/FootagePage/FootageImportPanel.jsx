import React from "react";
import { Badge, Button, Card } from "../../ui.js";
import { fileSizeLabel, formatCount } from "../../shared/utils.js";

export function FootageImportPanel({
  fileInputRef,
  selectedFiles,
  isImporting,
  targetDir,
  onFileChange,
  onImport,
}) {
  return (
    <Card className="rounded-md border border-base-300 bg-base-100/90 shadow-lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Import Footage
            </p>
            <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
              Tambah video ke workspace
            </h3>
          </div>
          <Badge type="info" className="px-3 py-3">
            {formatCount(selectedFiles.length, "file dipilih")}
          </Badge>
        </div>

        <div className="rounded-md border border-dashed border-base-300 bg-base-200/30 p-4">
          <p className="text-sm text-slate-700">
            Target import:
            <span className="ml-2 font-mono text-[12px] font-semibold text-slate-900">{targetDir}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Format yang didukung: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.avi,.mov,.mkv,.webm,video/*"
            multiple
            className="file-input file-input-bordered mt-4 w-full"
            onChange={onFileChange}
          />
        </div>

        {selectedFiles.length > 0 ? (
          <div className="grid gap-2">
            {selectedFiles.slice(0, 5).map((file) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{file.type || "video"}</p>
                </div>
                <Badge type="ghost" className="px-3 py-2">
                  {fileSizeLabel(file.size)}
                </Badge>
              </div>
            ))}
            {selectedFiles.length > 5 ? (
              <p className="text-xs text-slate-500">
                dan {selectedFiles.length - 5} file lain akan ikut diimport.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="info"
            isSubmit={false}
            className="rounded-md px-5"
            disabled={!selectedFiles.length}
            loading={isImporting}
            onClick={onImport}
          >
            Import Footage
          </Button>
        </div>
      </div>
    </Card>
  );
}
