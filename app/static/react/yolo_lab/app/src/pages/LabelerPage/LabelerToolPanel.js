import React from "react";
import { Alert, Badge, Button, Card, Input, Paragraph, Select } from "../../ui.js";
/**
 * Right sidebar tool panel component for LabelerPage
 * Contains class selection, tools, undo, and box list
 */
export function LabelerToolPanel({ classNames, selectedBox, selectedBoxId, activeClassId, dirty, boxes, currentImageName, undoStack, hasLabelFile, parseError, currentIsCheckpoint, checkpointImageName, zoomLabel, autolabelConfig, autolabelSuggestions, autolabelWarnings, isAutolabeling, onSyncSelectedBoxClass, onUndo, onRemoveBox, onClearAllBoxes, onReloadLabel, onAutolabel, onAutolabelConfigChange, onBoxSelect, }) {
    return (React.createElement("div", { className: "grid gap-4" },
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex items-center justify-between gap-3" },
                    React.createElement("h3", { className: "text-lg font-bold" }, "Class & Status"),
                    React.createElement(Badge, { type: dirty ? "warning" : "success", className: "px-3 py-3" }, dirty ? "Belum disimpan" : "Sinkron")),
                React.createElement(Select, { name: "active-class", label: "Class aktif", value: String(selectedBox ? selectedBox.classId : activeClassId), onChange: (event) => onSyncSelectedBoxClass(event.target.value), options: classNames.map((name, index) => ({
                        value: String(index),
                        label: `${index} - ${name}`,
                    })) }),
                React.createElement("div", { className: "space-y-3 rounded-sm border border-base-300 bg-base-200/30 p-4" },
                    React.createElement("div", { className: "flex items-center justify-between gap-3" },
                        React.createElement("div", null,
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Auto-label"),
                            React.createElement(Paragraph, { className: "mt-1 text-xs opacity-100" }, "Label otomatis hanya untuk frame yang sedang tampil.")),
                        React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, "Frame aktif")),
                    React.createElement(Input, { name: "autolabel-model", label: "Auto-label model", placeholder: "edge/yolo26x.pt", helpText: "Path file `.pt` lokal atau nama model Ultralytics untuk bootstrap label.", value: autolabelConfig.model, onChange: (event) => onAutolabelConfigChange({
                            ...autolabelConfig,
                            model: event.target.value,
                        }), list: autolabelSuggestions.length ? "autolabel-model-suggestions" : undefined }),
                    autolabelSuggestions.length ? (React.createElement("datalist", { id: "autolabel-model-suggestions" }, autolabelSuggestions.map((item) => (React.createElement("option", { key: item, value: item }))))) : null,
                    React.createElement(Button, { variant: "warning", isSubmit: false, className: "rounded-sm", disabled: !currentImageName || !autolabelConfig.model, loading: isAutolabeling, onClick: onAutolabel }, "Auto-label frame ini"),
                    autolabelWarnings.length ? (React.createElement(Alert, { type: "warning", className: "rounded-sm text-sm" }, autolabelWarnings[0])) : null),
                React.createElement("div", { className: "grid gap-3" },
                    React.createElement(Button, { variant: "ghost", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !undoStack.length, onClick: onUndo }, "Undo (Ctrl+Z)"),
                    React.createElement(Button, { variant: "ghost", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !selectedBox, onClick: () => selectedBox && onRemoveBox(selectedBox.id) }, "Hapus box terpilih"),
                    React.createElement(Button, { variant: "ghost", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !boxes.length, onClick: () => {
                            const ok = window.confirm("Hapus semua box pada frame ini?");
                            if (ok) {
                                onClearAllBoxes();
                            }
                        } }, "Kosongkan box"),
                    React.createElement(Button, { variant: "ghost", isSubmit: false, className: "rounded-sm border border-base-300 bg-base-100", disabled: !currentImageName, onClick: onReloadLabel }, "Reload label")),
                React.createElement("div", { className: "grid gap-3" },
                    [
                        ["File label", hasLabelFile ? "Sudah ada" : "Belum ada"],
                        ["Total box", String(boxes.length)],
                        ["Checkpoint", currentIsCheckpoint ? "Frame ini" : checkpointImageName || "Belum diatur"],
                        ["Zoom", zoomLabel],
                        ["Undo", `${undoStack.length} langkah`],
                    ].map(([label, value]) => (React.createElement("div", { key: label, className: "flex items-start justify-between gap-3 rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                        React.createElement("span", { className: "text-slate-500" }, label),
                        React.createElement("strong", { className: "max-w-[60%] break-all text-right text-slate-900" }, value)))),
                    parseError ? (React.createElement(Alert, { type: "warning", className: "rounded-sm text-sm" }, "Label lama invalid, box dimulai kosong.")) : null))),
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex items-center justify-between gap-3" },
                    React.createElement("h3", { className: "text-lg font-bold" }, "Boxes"),
                    React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, boxes.length)),
                React.createElement("div", { className: "max-h-[320px] space-y-3 overflow-auto pr-1" }, currentImageName ? (boxes.length ? (boxes.map((box, index) => {
                    const className = classNames[box.classId] || `class ${box.classId}`;
                    return (React.createElement("button", { key: box.id, type: "button", onClick: () => onBoxSelect(box.id), className: `w-full rounded-sm border bg-base-100 p-4 text-left transition ${box.id === selectedBoxId
                            ? "border-warning bg-warning/10 shadow-md"
                            : "border-base-300"}` },
                        React.createElement("div", { className: "flex items-start justify-between gap-3" },
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-sm font-semibold text-slate-900" },
                                    "Box ",
                                    index + 1),
                                React.createElement(Paragraph, { className: "mt-2 text-xs opacity-100" },
                                    "x=",
                                    Math.round(box.x),
                                    ", y=",
                                    Math.round(box.y),
                                    ", w=",
                                    Math.round(box.width),
                                    ", h=",
                                    Math.round(box.height))),
                            React.createElement(Badge, { type: "info", className: "px-3 py-3" }, className))));
                })) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Belum ada box. Drag pada image untuk membuat box pertama."))) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Belum ada frame yang dibuka."))))),
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
            React.createElement("div", { className: "space-y-3" },
                React.createElement("h3", { className: "text-lg font-bold" }, "Petunjuk"),
                React.createElement("ul", { className: "list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600" },
                    React.createElement("li", null, "Drag area kosong untuk membuat box baru."),
                    React.createElement("li", null, "Klik box untuk pilih, lalu drag isi box untuk geser."),
                    React.createElement("li", null, "Drag sudut box untuk resize."),
                    React.createElement("li", null,
                        React.createElement("code", { className: "rounded-sm bg-base-200 px-2 py-1 text-xs" }, "Ctrl+Z"),
                        " untuk undo,",
                        " ",
                        React.createElement("code", { className: "rounded-sm bg-base-200 px-2 py-1 text-xs" }, "Ctrl+S"),
                        " untuk simpan."),
                    React.createElement("li", null,
                        React.createElement("code", { className: "rounded-sm bg-base-200 px-2 py-1 text-xs" }, "Ctrl + scroll"),
                        " untuk zoom,",
                        " ",
                        React.createElement("code", { className: "rounded-sm bg-base-200 px-2 py-1 text-xs" }, "Ctrl+0"),
                        " untuk kembali fit."),
                    React.createElement("li", null, "Frame tanpa objek bisa disimpan sebagai label kosong."))))));
}
