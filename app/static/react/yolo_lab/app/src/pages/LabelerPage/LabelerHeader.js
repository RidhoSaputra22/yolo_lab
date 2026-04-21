import React from "react";
import { Alert, Button, Card, Paragraph } from "../../ui.js";
/**
 * Header component for LabelerPage showing current image info and navigation
 */
export function LabelerHeader({ currentImageItem, visibleImages, hasFrames, interactionLocked, currentIndex, currentIsCheckpoint, checkpointImageName, naturalSize, zoomLabel, notice, onNavigate, onOpenCheckpoint, onSaveCheckpoint, onOpenAutolabelModal, onSaveLabel, onSaveLabelAndNext, }) {
    return (React.createElement("section", { className: "grid gap-4" },
        notice?.message ? (React.createElement(Alert, { type: notice.type === "error" ? "error" : notice.type === "success" ? "success" : "info", className: "rounded-sm shadow-md" }, notice.message)) : null,
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-xl" },
            React.createElement("div", { className: "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700" }, "Frame Aktif"),
                    React.createElement("h2", { className: "mt-2 text-2xl font-bold tracking-tight text-slate-900" }, currentImageItem ? currentImageItem.name : "Belum ada frame"),
                    React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, currentImageItem
                        ? `${currentIndex >= 0 ? `${currentIndex + 1}/${visibleImages.length}` : "frame aktif"} • ${naturalSize.width || "-"} x ${naturalSize.height || "-"} px${currentIsCheckpoint ? " • checkpoint aktif" : ""}`
                        : "Pilih frame di panel kiri.")),
                React.createElement("div", { className: "flex flex-wrap gap-2" },
                    React.createElement(Button, { variant: "ghost", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !visibleImages.length || interactionLocked, onClick: () => onNavigate(-1) }, "Prev"),
                    React.createElement(Button, { variant: "ghost", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !visibleImages.length || interactionLocked, onClick: () => onNavigate(1) }, "Next"),
                    React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm", disabled: !checkpointImageName || interactionLocked, onClick: onOpenCheckpoint }, "Buka checkpoint"),
                    React.createElement(Button, { variant: "warning", isSubmit: false, className: "rounded-sm", disabled: !currentImageItem?.name || currentIsCheckpoint || interactionLocked, onClick: () => onSaveCheckpoint() }, currentIsCheckpoint ? "Checkpoint aktif" : "Jadikan checkpoint"),
                    React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm", disabled: !hasFrames, onClick: onOpenAutolabelModal }, "Auto Labeling"),
                    React.createElement(Button, { variant: "primary", isSubmit: false, className: "rounded-sm", disabled: !currentImageItem?.name || interactionLocked, onClick: onSaveLabel }, "Simpan"),
                    React.createElement(Button, { variant: "success", isSubmit: false, className: "rounded-sm", disabled: !currentImageItem?.name || interactionLocked, onClick: onSaveLabelAndNext }, "Simpan + Next"))))));
}
