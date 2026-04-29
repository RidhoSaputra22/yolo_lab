import React from "react";
import { Alert, Button, Card, Paragraph } from "../../ui.js";

/**
 * Canvas and image rendering component for LabelerPage
 * Handles drawing boxes and mouse interactions on the canvas overlay
 */
export function LabelerCanvas({
  currentImageName,
  imageSrc,
  displayMetrics,
  stageLayout,
  stageViewportRef,
  frameShellRef,
  overlayRef,
  zoomLevel,
  zoomLabel,
  minZoomLevel,
  maxZoomLevel,
  interactionDisabled = false,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onDeleteCurrentFrame,
  deleteDisabled = false,
  deleteBusy = false,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseLeave,
}) {
  return (
    <Card className="h-full rounded-md border border-base-300 bg-base-100/90 shadow-xl">
      <div className="flex h-full min-h-0 h-screen flex-col gap-4">
        {!currentImageName ? (
          <div className="grid min-h-0 flex-1 place-items-center rounded-md border border-dashed border-base-300 bg-base-200/40 p-8 text-center text-sm text-slate-500">
            Frame belum dimuat. Pilih salah satu item di sidebar.
          </div>
        ) : (
          <div className="relative min-h-0 flex-1">
            <div className="pointer-events-none absolute left-4 top-4 z-20">
              <div className="pointer-events-auto">
                <Button
                  variant="error"
                  outline
                  isSubmit={false}
                  size="sm"
                  className="rounded-md bg-base-100/95 px-4 shadow-md backdrop-blur"
                  disabled={deleteDisabled}
                  loading={deleteBusy}
                  onClick={onDeleteCurrentFrame}
                >
                  Hapus frame
                </Button>
              </div>
            </div>

            {interactionDisabled ? (
              <div className="pointer-events-none absolute inset-x-4 top-16 z-10">
                <Alert type="warning" className="rounded-md shadow-md">
                  Auto-label sedang berjalan. Edit bounding box dikunci sampai proses selesai.
                </Alert>
              </div>
            ) : null}
            <div
              ref={stageViewportRef}
              className="relative min-h-0 max-h-[550px] h-full flex-1 overflow-auto rounded-md border border-base-300 bg-base-100 p-4"
              style={{
                overscrollBehavior: "contain",
                backgroundImage:
                  "linear-gradient(135deg, rgba(216, 91, 52, 0.06), transparent 34%), linear-gradient(315deg, rgba(29, 111, 82, 0.07), transparent 28%)",
              }}
            >
              <div
                className="relative"
                style={{
                  width: stageLayout.contentWidth || "100%",
                  height: stageLayout.contentHeight || "100%",
                  minWidth: "100%",
                  minHeight: "100%",
                }}
              >
                <div
                  ref={frameShellRef}
                  className="absolute overflow-hidden rounded-md border border-base-300 bg-white shadow-2xl"
                  style={{
                    left: stageLayout.frameOffsetX,
                    top: stageLayout.frameOffsetY,
                    width: displayMetrics.width || undefined,
                    height: displayMetrics.height || undefined,
                  }}
                >
                  <img
                    src={imageSrc}
                    alt={currentImageName}
                    draggable="false"
                    className="block h-full w-full object-contain"
                    style={{
                      width: displayMetrics.width || undefined,
                      height: displayMetrics.height || undefined,
                    }}
                  />
                  <svg
                    ref={overlayRef}
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseLeave={onCanvasMouseLeave}
                    xmlns="http://www.w3.org/2000/svg"
                    width={displayMetrics.width || 0}
                    height={displayMetrics.height || 0}
                    viewBox={`0 0 ${displayMetrics.width || 0} ${displayMetrics.height || 0}`}
                    className="absolute inset-0 h-full w-full"
                    aria-label="Bounding box overlay"
                    style={{
                      width: displayMetrics.width || undefined,
                      height: displayMetrics.height || undefined,
                      pointerEvents: interactionDisabled ? "none" : "auto",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
