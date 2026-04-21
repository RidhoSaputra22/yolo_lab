import React from "react";
import { Badge, Button, Paragraph } from "../../ui.js";
import { LabelerSidebarSection } from "./LabelerSidebarSection.js";
/**
 * Header component for LabelerPage showing current image info and navigation
 */
export function LabelerHeader({ currentImageItem, visibleImages, hasFrames, interactionLocked, currentIndex, currentIsCheckpoint, checkpointImageName, naturalSize, zoomLabel, onNavigate, onOpenCheckpoint, onSaveCheckpoint, onOpenAutolabelModal, onSaveLabel, onSaveLabelAndNext, }) {
    return (React.createElement(LabelerSidebarSection, { title: "Frame Aktif", eyebrow: "Workspace", description: "Navigasi frame dan jalankan aksi utama labeling tanpa meninggalkan sidebar.", badge: React.createElement(Badge, { type: interactionLocked ? "warning" : "success", className: "px-3 py-3" }, interactionLocked ? "Terkunci" : "Siap edit"), defaultOpen: true },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", null,
                React.createElement("h2", { className: "break-all text-xl font-bold tracking-tight text-slate-900" }, currentImageItem ? currentImageItem.name : "Belum ada frame"),
                React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, currentImageItem
                    ? `${currentIndex >= 0 ? `${currentIndex + 1}/${visibleImages.length}` : "frame aktif"} • ${naturalSize.width || "-"} x ${naturalSize.height || "-"} px • zoom ${zoomLabel}${currentIsCheckpoint ? " • checkpoint aktif" : ""}`
                    : "Pilih frame dari panel daftar untuk mulai labeling.")),
            React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-sm border border-base-300 bg-base-100", disabled: !visibleImages.length || interactionLocked, onClick: () => onNavigate(-1) }, "Prev"),
                React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-sm border border-base-300 bg-base-100", disabled: !visibleImages.length || interactionLocked, onClick: () => onNavigate(1) }, "Next"),
                React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !checkpointImageName || interactionLocked, onClick: onOpenCheckpoint }, "Buka checkpoint"),
                React.createElement(Button, { variant: "warning", isSubmit: false, size: "sm", className: "rounded-sm", disabled: !currentImageItem?.name || currentIsCheckpoint || interactionLocked, onClick: () => onSaveCheckpoint() }, currentIsCheckpoint ? "Checkpoint aktif" : "Jadikan checkpoint"),
                React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !hasFrames, onClick: onOpenAutolabelModal }, "Auto Labeling"),
                React.createElement(Button, { variant: "primary", isSubmit: false, size: "sm", className: "rounded-sm", disabled: !currentImageItem?.name || interactionLocked, onClick: onSaveLabel }, "Simpan"),
                React.createElement(Button, { variant: "success", isSubmit: false, size: "sm", className: "col-span-2 rounded-sm", disabled: !currentImageItem?.name || interactionLocked, onClick: onSaveLabelAndNext }, "Simpan + Next")))));
}
