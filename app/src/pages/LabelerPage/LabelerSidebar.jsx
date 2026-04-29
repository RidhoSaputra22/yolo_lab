import React from "react";
import { Alert, Badge, Button, Input, Select } from "../../ui.js";
import { joinClasses } from "../../shared/utils.js";
import { LabelerSidebarSection } from "./LabelerSidebarSection.jsx";

/**
 * Left sidebar component for LabelerPage
 * Shows dataset navigator, frames list, and summary stats
 */
export function LabelerSidebar({
  images,
  visibleImages,
  currentImageName,
  activeFramesDir,
  activeLabelsDir,
  frameFolders,
  filterValue,
  searchQuery,
  isLoading,
  disabled = false,
  archiveDisabled = false,
  archiveWarning = "",
  onFramesDirChange,
  onFilterChange,
  onSearchChange,
  onRefresh,
  onOpenImportModal,
  onOpenExportModal,
  onImageSelect,
}) {
  const summaryCards = [
    { label: "Total frame", value: images.length },
    { label: "Sudah dilabel", value: images.filter((item) => item.hasLabelFile).length },
    {
      label: "Pending",
      value: images.length - images.filter((item) => item.hasLabelFile).length,
    },
    {
      label: "Total box",
      value: images.reduce((sum, item) => sum + Number(item.boxCount || 0), 0),
    },
  ];

  return (
    <div className="grid gap-4">
      <LabelerSidebarSection
        title="Dataset"
        eyebrow="Navigator"
        description="Atur folder aktif, filter daftar frame, dan ringkas progres labeling dari satu panel."
        badge={
          <Badge type="warning" className="px-3 py-3">
            {frameFolders.length}
          </Badge>
        }
        defaultOpen
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {summaryCards.map((item) => (
              <div
                key={item.label}
                className="yolo-muted-panel rounded-md border border-base-300 bg-base-200/40 px-3 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/60">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-bold text-base-content">{item.value}</p>
              </div>
            ))}
          </div>

          <Select
            name="labeler-frames-dir"
            label="Pilih subfolder frames"
            value={activeFramesDir || ""}
            onChange={(event) => onFramesDirChange(event.target.value)}
            options={frameFolders.map((folder) => ({
              value: folder.path,
              label: folder.label,
            }))}
            placeholder="Pilih folder frame..."
            helpText="Menentukan subfolder `train/frames` yang sedang dibuka di labeler. Saat diganti, daftar gambar dan pasangan folder label ikut berpindah."
            disabled={disabled}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              name="labeler-filter"
              label="Status frame"
              value={filterValue}
              onChange={(event) => onFilterChange(event.target.value)}
              options={[
                { value: "all", label: "Semua frame" },
                { value: "pending", label: "Belum dilabel" },
                { value: "done", label: "Sudah dilabel" },
              ]}
              helpText="Menyaring daftar frame berdasarkan progres labeling supaya review manual lebih cepat."
              disabled={disabled}
            />

            <Input
              name="labeler-search"
              label="Cari frame"
              placeholder="Cari nama file..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              helpText="Cari berdasarkan nama file untuk langsung melompat ke frame tertentu tanpa scroll panjang."
              disabled={disabled}
            />
          </div>

          <div className="yolo-muted-panel flex items-center justify-between gap-2 rounded-md border border-base-300 bg-base-200/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/60">
                Aktif
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-base-content/70">
                {activeFramesDir || "-"}
              </p>
            </div>
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-md border border-base-300 px-4"
              onClick={onRefresh}
              disabled={isLoading || disabled}
            >
              Refresh
            </Button>
          </div>
        </div>
      </LabelerSidebarSection>

      <LabelerSidebarSection
        title="Bundle"
        eyebrow="Import / Export"
        description="Satukan folder frame aktif dan pasangan label-nya ke bundle zip, atau masukkan bundle export kembali ke workspace."
        badge={
          <Badge type="info" className="px-3 py-3">
            ZIP
          </Badge>
        }
        defaultOpen
      >
        <div className="space-y-4">
          {archiveWarning ? (
            <Alert type="warning" className="rounded-md text-sm">
              {archiveWarning}
            </Alert>
          ) : (
            <Alert type="info" className="rounded-md text-sm">
              Import menerima bundle hasil export labeler ini dengan isi `frames/` dan `labels/`.
            </Alert>
          )}

          <div className="grid gap-3">
            <div className="yolo-muted-panel rounded-md border border-base-300 bg-base-200/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/60">
                Frames aktif
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-base-content/70">
                {activeFramesDir || "-"}
              </p>
            </div>
            <div className="yolo-muted-panel rounded-md border border-base-300 bg-base-200/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/60">
                Labels aktif
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-base-content/70">
                {activeLabelsDir || "-"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="info"
              isSubmit={false}
              className="rounded-md px-4"
              onClick={onOpenImportModal}
              disabled={archiveDisabled}
            >
              Import Frames
            </Button>
            <Button
              variant="warning"
              isSubmit={false}
              className="rounded-md px-4"
              onClick={onOpenExportModal}
              disabled={archiveDisabled}
            >
              Export Frames
            </Button>
          </div>
        </div>
      </LabelerSidebarSection>

      <LabelerSidebarSection
        title="Frames"
        eyebrow="Browser"
        description="Pilih frame yang ingin dilabel dari daftar aktif."
        badge={
          <Badge type="info" className="px-3 py-3">
            {visibleImages.length}
          </Badge>
        }
        defaultOpen
      >
        <div className="space-y-3 h-[400px] overflow-auto">
          {visibleImages.length ? (
            visibleImages.map((item) => {
              const itemState = item.parseError
                ? { type: "error", label: "Label invalid" }
                : item.hasLabelFile
                  ? { type: "success", label: "Ada file label" }
                  : { type: "ghost", label: "Belum ada file" };

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onImageSelect(item.name)}
                  disabled={disabled}
                  className={joinClasses(
                    "w-full rounded-md border p-4 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-70",
                    item.name === currentImageName
                      ? "border-warning bg-warning/10 shadow-md"
                      : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all text-sm font-semibold text-base-content">{item.name}</p>
                    <Badge type="warning" className="px-3 py-3">
                      {item.boxCount || 0}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge type={itemState.type} className="px-3 py-3">
                      {itemState.label}
                    </Badge>
                    {item.isCheckpoint ? (
                      <Badge type="warning" outline className="px-3 py-3">
                        Checkpoint
                      </Badge>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <Alert type="info" className="rounded-md text-sm">
              Tidak ada frame yang cocok dengan filter saat ini.
            </Alert>
          )}
        </div>
      </LabelerSidebarSection>
    </div>
  );
}
