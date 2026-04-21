import React from "react";
import { Alert, Badge, Button, Card, Select } from "../../ui.js";
import { joinClasses } from "../../shared/utils.js";

/**
 * Left sidebar component for LabelerPage
 * Shows dataset navigator, frames list, and summary stats
 */
export function LabelerSidebar({
  images,
  visibleImages,
  currentImageName,
  activeFramesDir,
  frameFolders,
  filterValue,
  searchQuery,
  isLoading,
  disabled = false,
  onFramesDirChange,
  onFilterChange,
  onSearchChange,
  onRefresh,
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
    <aside className="grid h-fit gap-4 xl:sticky xl:top-28">
      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Folder Frame</h3>
            <Badge type="warning" className="px-3 py-3">
              {frameFolders.length}
            </Badge>
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
            helpText="Labeler akan memuat frame dari subfolder `train/frames` yang kamu pilih."
            disabled={disabled}
          />

          <div className="flex items-center justify-between gap-2 rounded-sm border border-base-300 bg-base-200/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Aktif
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-slate-700">
                {activeFramesDir || "-"}
              </p>
            </div>
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-sm border border-base-300 px-4"
              onClick={onRefresh}
              disabled={isLoading || disabled}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Frames</h3>
            <Badge type="info" className="px-3 py-3">
              {visibleImages.length}
            </Badge>
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
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
                      "w-full rounded-sm border p-4 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-70",
                      item.name === currentImageName
                        ? "border-warning bg-warning/10 shadow-md"
                        : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all text-sm font-semibold text-slate-900">{item.name}</p>
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
              <Alert type="info" className="rounded-sm text-sm">
                Tidak ada frame yang cocok dengan filter saat ini.
              </Alert>
            )}
          </div>
        </div>
      </Card>
    </aside>
  );
}
