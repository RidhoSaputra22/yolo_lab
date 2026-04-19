import React from "react";
import { Alert, Badge, Button, Card, Paragraph } from "../../ui.js";

/**
 * Header component for LabelerPage showing current image info and navigation
 */
export function LabelerHeader({
  currentImageItem,
  visibleImages,
  currentIndex,
  currentIsCheckpoint,
  checkpointImageName,
  naturalSize,
  zoomLabel,
  notice,
  onNavigate,
  onOpenCheckpoint,
  onSaveCheckpoint,
  onSaveLabel,
  onSaveLabelAndNext,
}) {
  return (
    <section className="grid gap-4">
      {notice?.message ? (
        <Alert
          type={notice.type === "error" ? "error" : notice.type === "success" ? "success" : "info"}
          className="rounded-sm shadow-md"
        >
          {notice.message}
        </Alert>
      ) : null}

      <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
              Frame Aktif
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {currentImageItem ? currentImageItem.name : "Belum ada frame"}
            </h2>
            <Paragraph className="mt-2 text-sm leading-6 opacity-100">
              {currentImageItem
                ? `${currentIndex >= 0 ? `${currentIndex + 1}/${visibleImages.length}` : "frame aktif"} • ${
                    naturalSize.width || "-"
                  } x ${naturalSize.height || "-"} px${currentIsCheckpoint ? " • checkpoint aktif" : ""}`
                : "Pilih frame di panel kiri."}
            </Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              isSubmit={false}
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!visibleImages.length}
              onClick={() => onNavigate(-1)}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              isSubmit={false}
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!visibleImages.length}
              onClick={() => onNavigate(1)}
            >
              Next
            </Button>
            <Button
              variant="warning"
              outline
              isSubmit={false}
              className="rounded-sm"
              disabled={!checkpointImageName}
              onClick={onOpenCheckpoint}
            >
              Buka checkpoint
            </Button>
            <Button
              variant="warning"
              isSubmit={false}
              className="rounded-sm"
              disabled={!currentImageItem?.name || currentIsCheckpoint}
              onClick={() => onSaveCheckpoint()}
            >
              {currentIsCheckpoint ? "Checkpoint aktif" : "Jadikan checkpoint"}
            </Button>
            <Button
              variant="primary"
              isSubmit={false}
              className="rounded-sm"
              disabled={!currentImageItem?.name}
              onClick={onSaveLabel}
            >
              Simpan
            </Button>
            <Button
              variant="success"
              isSubmit={false}
              className="rounded-sm"
              disabled={!currentImageItem?.name}
              onClick={onSaveLabelAndNext}
            >
              Simpan + Next
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
