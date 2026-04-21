import React from "react";
import { Badge, Button, Paragraph } from "../../ui.js";
import { LabelerSidebarSection } from "./LabelerSidebarSection.jsx";

/**
 * Header component for LabelerPage showing current image info and navigation
 */
export function LabelerHeader({
  currentImageItem,
  visibleImages,
  hasFrames,
  interactionLocked,
  currentIndex,
  currentIsCheckpoint,
  checkpointImageName,
  naturalSize,
  zoomLabel,
  onNavigate,
  onOpenCheckpoint,
  onSaveCheckpoint,
  onOpenAutolabelModal,
  onSaveLabel,
  onSaveLabelAndNext,
}) {
  return (
    <LabelerSidebarSection
      title="Frame Aktif"
      eyebrow="Workspace"
      description="Navigasi frame dan jalankan aksi utama labeling tanpa meninggalkan sidebar."
      badge={
        <Badge type={interactionLocked ? "warning" : "success"} className="px-3 py-3">
          {interactionLocked ? "Terkunci" : "Siap edit"}
        </Badge>
      }
      defaultOpen
    >
      <div className="space-y-4">
        <div>
          <h2 className="break-all text-xl font-bold tracking-tight text-slate-900">
            {currentImageItem ? currentImageItem.name : "Belum ada frame"}
          </h2>
          <Paragraph className="mt-2 text-sm leading-6 opacity-100">
            {currentImageItem
              ? `${currentIndex >= 0 ? `${currentIndex + 1}/${visibleImages.length}` : "frame aktif"} • ${
                  naturalSize.width || "-"
                } x ${naturalSize.height || "-"} px • zoom ${zoomLabel}${
                  currentIsCheckpoint ? " • checkpoint aktif" : ""
                }`
              : "Pilih frame dari panel daftar untuk mulai labeling."}
          </Paragraph>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            isSubmit={false}
            size="sm"
            className="rounded-sm border border-base-300 bg-base-100"
            disabled={!visibleImages.length || interactionLocked}
            onClick={() => onNavigate(-1)}
          >
            Prev
          </Button>
          <Button
            variant="ghost"
            isSubmit={false}
            size="sm"
            className="rounded-sm border border-base-300 bg-base-100"
            disabled={!visibleImages.length || interactionLocked}
            onClick={() => onNavigate(1)}
          >
            Next
          </Button>
          <Button
            variant="warning"
            outline
            isSubmit={false}
            size="sm"
            className="rounded-sm"
            disabled={!checkpointImageName || interactionLocked}
            onClick={onOpenCheckpoint}
          >
            Buka checkpoint
          </Button>
          <Button
            variant="warning"
            isSubmit={false}
            size="sm"
            className="rounded-sm"
            disabled={!currentImageItem?.name || currentIsCheckpoint || interactionLocked}
            onClick={() => onSaveCheckpoint()}
          >
            {currentIsCheckpoint ? "Checkpoint aktif" : "Jadikan checkpoint"}
          </Button>
          <Button
            variant="warning"
            outline
            isSubmit={false}
            size="sm"
            className="rounded-sm"
            disabled={!hasFrames}
            onClick={onOpenAutolabelModal}
          >
            Auto Labeling
          </Button>
          <Button
            variant="primary"
            isSubmit={false}
            size="sm"
            className="rounded-sm"
            disabled={!currentImageItem?.name || interactionLocked}
            onClick={onSaveLabel}
          >
            Simpan
          </Button>
          <Button
            variant="success"
            isSubmit={false}
            size="sm"
            className="col-span-2 rounded-sm"
            disabled={!currentImageItem?.name || interactionLocked}
            onClick={onSaveLabelAndNext}
          >
            Simpan + Next
          </Button>
        </div>
      </div>
    </LabelerSidebarSection>
  );
}
