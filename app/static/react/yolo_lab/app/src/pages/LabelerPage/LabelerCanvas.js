import React from "react";
import { Alert, Badge, Button, Card, Paragraph } from "../../ui.js";
/**
 * Canvas and image rendering component for LabelerPage
 * Handles drawing boxes and mouse interactions on the canvas overlay
 */
export function LabelerCanvas({ currentImageName, imageSrc, displayMetrics, stageLayout, stageViewportRef, frameShellRef, overlayRef, zoomLevel, zoomLabel, minZoomLevel, maxZoomLevel, onZoomIn, onZoomOut, onResetZoom, onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseLeave, }) {
    return (React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-xl" },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700" }, "Canvas"),
                    React.createElement("h2", { className: "mt-2 text-xl font-bold tracking-tight" }, "Stage Labeling")),
                React.createElement("div", { className: "flex items-center gap-2" },
                    React.createElement(Button, { variant: "ghost", size: "sm", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !currentImageName || zoomLevel <= minZoomLevel, onClick: onZoomOut }, "-"),
                    React.createElement(Button, { variant: "ghost", size: "sm", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100 text-xs font-semibold", disabled: !currentImageName, onClick: onResetZoom }, zoomLabel),
                    React.createElement(Button, { variant: "ghost", size: "sm", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !currentImageName || zoomLevel >= maxZoomLevel, onClick: onZoomIn }, "+"))),
            !currentImageName ? (React.createElement("div", { className: "grid min-h-[420px] place-items-center rounded-sm border border-dashed border-base-300 bg-base-200/40 p-8 text-center text-sm text-slate-500" }, "Frame belum dimuat. Pilih salah satu item di sidebar.")) : (React.createElement("div", { ref: stageViewportRef, className: "relative max-h-[72vh] min-h-[420px] overflow-auto rounded-sm border border-base-300 bg-base-100 p-4", style: {
                    overscrollBehavior: "contain",
                    backgroundImage: "linear-gradient(135deg, rgba(216, 91, 52, 0.06), transparent 34%), linear-gradient(315deg, rgba(29, 111, 82, 0.07), transparent 28%)",
                } },
                React.createElement("div", { className: "relative", style: {
                        width: stageLayout.contentWidth || "100%",
                        height: stageLayout.contentHeight || "100%",
                        minWidth: "100%",
                        minHeight: "100%",
                    } },
                    React.createElement("div", { ref: frameShellRef, className: "absolute overflow-hidden rounded-sm border border-base-300 bg-white shadow-2xl", style: {
                            left: stageLayout.frameOffsetX,
                            top: stageLayout.frameOffsetY,
                            width: displayMetrics.width || undefined,
                            height: displayMetrics.height || undefined,
                        } },
                        React.createElement("img", { src: imageSrc, alt: currentImageName, draggable: "false", className: "block h-full w-full object-contain", style: {
                                width: displayMetrics.width || undefined,
                                height: displayMetrics.height || undefined,
                            } }),
                        React.createElement("canvas", { ref: overlayRef, onMouseDown: onCanvasMouseDown, onMouseMove: onCanvasMouseMove, onMouseLeave: onCanvasMouseLeave, className: "absolute inset-0 h-full w-full", style: {
                                width: displayMetrics.width || undefined,
                                height: displayMetrics.height || undefined,
                            } }))))))));
}
