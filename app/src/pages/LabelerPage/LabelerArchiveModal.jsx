import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Input, Modal } from "../../ui.js";
import { fileSizeLabel, formatCount, joinClasses } from "../../shared/utils.js";

function normalizeMode(value) {
  return value === "export" ? "export" : "import";
}

export function LabelerArchiveModal({
  open,
  initialMode = "import",
  onClose,
  activeFramesDir,
  activeLabelsDir,
  images,
  classNames,
  currentImageName,
  disabled = false,
  warningMessage = "",
  onImport,
  onExport,
}) {
  const [mode, setMode] = useState(normalizeMode(initialMode));
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetSubdir, setTargetSubdir] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef(null);

  const labeledCount = useMemo(
    () => (images || []).filter((item) => item.hasLabelFile).length,
    [images],
  );
  const pendingCount = Math.max(0, (images || []).length - labeledCount);
  const totalBoxes = useMemo(
    () => (images || []).reduce((sum, item) => sum + Number(item.boxCount || 0), 0),
    [images],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode(normalizeMode(initialMode));
  }, [open, initialMode]);

  useEffect(() => {
    if (open) {
      return;
    }
    setSelectedFile(null);
    setTargetSubdir("");
    setIsImporting(false);
    setIsExporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [open]);

  const handleImport = async () => {
    if (!selectedFile || disabled || isImporting || isExporting) {
      return;
    }

    setIsImporting(true);
    try {
      const shouldReset = await onImport?.({
        file: selectedFile,
        targetSubdir,
      });
      if (shouldReset) {
        setSelectedFile(null);
        setTargetSubdir("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    if (disabled || isImporting || isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      await onExport?.();
    } finally {
      setIsExporting(false);
    }
  };

  const metricCards = [
    { label: "Frames", value: formatCount((images || []).length, "file") },
    { label: "Labeled", value: formatCount(labeledCount, "file") },
    { label: "Pending", value: formatCount(pendingCount, "file") },
    { label: "Classes", value: formatCount((classNames || []).length, "kelas") },
  ];

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isImporting && !isExporting) {
          onClose?.();
        }
      }}
      title="Import / Export Frames"
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              key: "import",
              title: "Import Frames",
              detail: "Masukkan bundle zip hasil export YOLO Lab ke workspace frames aktif.",
            },
            {
              key: "export",
              title: "Export Frames",
              detail: "Unduh bundle zip berisi pasangan folder frames dan labels aktif.",
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={joinClasses(
                "rounded-sm border px-4 py-3 text-left transition duration-150",
                mode === item.key
                  ? "border-warning bg-warning/10 shadow-sm"
                  : "border-base-300 bg-base-100 hover:border-base-content/20",
              )}
              onClick={() => setMode(item.key)}
              disabled={isImporting || isExporting}
            >
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>
            </button>
          ))}
        </div>

        {warningMessage ? (
          <Alert type="warning" className="rounded-sm text-sm">
            {warningMessage}
          </Alert>
        ) : (
          <Alert type="info" className="rounded-sm text-sm">
            Bundle export selalu menyatukan isi `frames/`, `labels/`, dan metadata archive
            supaya bisa diimport ulang oleh labeler ini.
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-base-300 bg-base-200/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Frames aktif
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-slate-800">
              {activeFramesDir || "-"}
            </p>
          </div>
          <div className="rounded-sm border border-base-300 bg-base-200/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Labels aktif
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-slate-800">
              {activeLabelsDir || "-"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {metricCards.map((item) => (
            <div
              key={item.label}
              className="rounded-sm border border-base-300 bg-base-100 px-4 py-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        {mode === "import" ? (
          <div className="space-y-4">
            <div className="rounded-sm border border-dashed border-base-300 bg-base-200/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Pilih bundle zip untuk diimport
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Hanya menerima bundle hasil export labeler ini dengan struktur `frames/` dan
                    `labels/`.
                  </p>
                </div>
                <Badge type="info" className="px-3 py-2">
                  .zip
                </Badge>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                className="file-input file-input-bordered mt-4 w-full"
                disabled={disabled || isImporting || isExporting}
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] || null);
                }}
              />
            </div>

            <Input
              name="labeler-import-target-subdir"
              label="Subfolder target (opsional)"
              placeholder="contoh: batch_perpustakaan"
              value={targetSubdir}
              onChange={(event) => setTargetSubdir(event.target.value)}
              helpText="Kosongkan untuk memakai subfolder bawaan dari bundle. Isi satu nama folder jika ingin import ke pasangan `train/frames/<folder>` dan `train/labels/<folder>`."
              disabled={disabled || isImporting || isExporting}
            />

            {selectedFile ? (
              <div className="rounded-sm border border-base-300 bg-base-100 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold text-slate-900">
                      {selectedFile.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedFile.type || "application/zip"}
                    </p>
                  </div>
                  <Badge type="ghost" className="px-3 py-2">
                    {fileSizeLabel(selectedFile.size)}
                  </Badge>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Import akan menolak file yang bentrok dengan nama file yang sudah ada agar data lama
                tidak tertimpa diam-diam.
              </div>
              <Button
                variant="info"
                isSubmit={false}
                className="rounded-sm px-5"
                disabled={!selectedFile || disabled}
                loading={isImporting}
                onClick={handleImport}
              >
                Import Frames
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-sm border border-base-300 bg-base-100 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">
                Bundle export dari folder aktif
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Export akan menggabungkan semua frame di folder aktif, semua file label `.txt`, dan
                checkpoint jika ada, ke dalam satu file zip yang siap dipindahkan ke project YOLO
                Lab lain.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-sm border border-base-300 bg-base-200/40 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Current frame
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                    {currentImageName || "-"}
                  </p>
                </div>
                <div className="rounded-sm border border-base-300 bg-base-200/40 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Total box
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatCount(totalBoxes, "bounding box")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Simpan frame aktif lebih dulu jika ada perubahan, supaya isi zip sama dengan label
                terakhir di disk.
              </div>
              <Button
                variant="warning"
                isSubmit={false}
                className="rounded-sm px-5"
                disabled={disabled || !(images || []).length}
                loading={isExporting}
                onClick={handleExport}
              >
                Export Frames
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
