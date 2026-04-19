import React from "react";
import { Alert, Badge, Button, Card, Input, Paragraph, Select } from "../../ui.js";
import { formatCount, joinClasses } from "../../shared/utils.js";

/**
 * Left sidebar component for LabelerPage
 * Shows dataset navigator, frames list, and summary stats
 */
export function LabelerSidebar({
  images,
  visibleImages,
  currentImageName,
  filterValue,
  searchQuery,
  isLoading,
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
                    className={joinClasses(
                      "w-full rounded-sm border p-4 text-left transition duration-150",
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
