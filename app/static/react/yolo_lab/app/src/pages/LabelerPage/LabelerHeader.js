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
                React.createElement("h2", { className: "break-all text-lg font-bold tracking-tight text-slate-900" }, currentImageItem ? currentImageItem.name : "Belum ada frame"),
                React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, currentImageItem
                    ? `${currentIndex >= 0 ? `${currentIndex + 1}/${visibleImages.length}` : "frame aktif"} • ${naturalSize.width || "-"} x ${naturalSize.height || "-"} px • zoom ${zoomLabel}${currentIsCheckpoint ? " • checkpoint aktif" : ""}`
                    : "Pilih frame dari panel daftar untuk mulai labeling.")),
            React.createElement("div", { className: "grid grid-cols-5 gap-2" },
                React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-md border border-base-300 bg-base-100", disabled: !visibleImages.length || interactionLocked, onClick: () => onNavigate(-1), toolTip: "Frame sebelumnya", toolTipPosition: "top" },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "size-6" },
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" }))),
                React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-md border border-base-300 bg-base-100", disabled: !visibleImages.length || interactionLocked, onClick: () => onNavigate(1), toolTip: "Frame berikutnya", toolTipPosition: "top" },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "size-6" },
                        React.createElement("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" }))),
                React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, size: "sm", className: "rounded-md", disabled: !checkpointImageName || interactionLocked, onClick: onOpenCheckpoint, toolTip: "Lihat checkpoint", toolTipPosition: "top" },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "size-6" },
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" }),
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" }))),
                React.createElement(Button, { variant: "warning", isSubmit: false, size: "sm", className: "rounded-md", disabled: !currentImageItem?.name ||
                        currentIsCheckpoint ||
                        interactionLocked, onClick: () => onSaveCheckpoint(), toolTip: "Simpan checkpoint", toolTipPosition: "top" }, currentIsCheckpoint ? (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "size-6" },
                    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }))) : (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "size-6" },
                    React.createElement("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" })))),
                React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, size: "sm", className: "rounded-md", disabled: !hasFrames, onClick: onOpenAutolabelModal, toolTip: "Autolabel", toolTipPosition: "top" },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "size-6" },
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" }),
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 6h.008v.008H6V6Z" }))),
                React.createElement(Button, { variant: "primary", isSubmit: false, size: "sm", className: "rounded-md", disabled: !currentImageItem?.name || interactionLocked, onClick: onSaveLabel, toolTip: "Simpan label", toolTipPosition: "top" },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "size-6" },
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" }))),
                React.createElement(Button, { variant: "success", isSubmit: false, size: "sm", className: "col-span-2 rounded-md", disabled: !currentImageItem?.name || interactionLocked, onClick: onSaveLabelAndNext, toolTip: "Simpan label dan frame berikutnya", toolTipPosition: "top" }, "Simpan dan lanjut")))));
}
