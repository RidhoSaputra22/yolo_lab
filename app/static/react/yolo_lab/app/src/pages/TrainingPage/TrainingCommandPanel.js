import React from "react";
import { Alert, Badge, Card, Paragraph, Select } from "../../ui.js";
import { formatCount } from "../../shared/utils.js";
import { FormFieldControl } from "../../components/FormFieldControl.js";
/**
 * Training command preview and configuration panel
 * Shows form fields and renders command preview
 */
export function TrainingCommandPanel({ layout, formValues, suggestions, frameFolders, preview, previewError, previewState, presetSummary, onFieldChange, onFrameFolderChange, }) {
    const previewBadge = {
        idle: { type: "ghost", label: "menunggu" },
        loading: { type: "info", label: "memuat" },
        ready: { type: "success", label: "sinkron" },
        error: { type: "error", label: "error" },
    }[previewState];
    return (React.createElement(Card, { className: "min-w-0 rounded-md border border-base-300 bg-base-100/90 shadow-xl" },
        React.createElement("div", { className: "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between" },
            React.createElement("div", null,
                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700" }, "Command Preview"),
                React.createElement("h2", { className: "mt-2 text-2xl font-bold tracking-tight text-slate-900" }, "Preview Prepare + Training"),
                React.createElement(Paragraph, { className: "mt-2 max-w-3xl text-sm leading-6 text-slate-600 opacity-100" }, "Form ini menjalankan `prepare-train` dari `yolo_train.py`: bangun dataset dari label aktif, lalu langsung train model tanpa auto-label ulang.")),
            React.createElement(Badge, { type: previewBadge.type, className: "self-start px-3 py-3" }, previewBadge.label)),
        React.createElement("div", { className: "mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" },
            React.createElement("div", { className: "grid gap-3" },
                React.createElement(Card, { className: "min-w-0 rounded-md border border-base-300 bg-base-100/90 shadow-lg" },
                    React.createElement("div", { className: "space-y-3" },
                        React.createElement("div", { className: "flex items-start justify-between gap-3" },
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700" }, "Frame Folder"),
                                React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Pilih subfolder di `train/frames` yang mau dipakai untuk labeling lanjut dan training.")),
                            React.createElement(Badge, { type: "info", className: "px-3 py-3" }, formatCount(frameFolders.length, "folder"))),
                        React.createElement(Select, { name: "training-frames-dir", label: "Folder frame aktif", value: formValues.framesDir || "", onChange: (event) => onFrameFolderChange(event.target.value), options: frameFolders.map((folder) => ({
                                value: folder.path,
                                label: folder.label,
                            })), placeholder: "Pilih folder frame...", helpText: "Pilih subfolder frame yang sedang kamu pakai. Saat diganti, `framesDir` dan pasangan `labelsDir` ikut diselaraskan agar training tetap memakai pasangan data yang benar." }))),
                (layout || []).map((section) => (React.createElement("details", { key: section.id, className: "rounded-md border border-base-300 bg-base-100/85", open: section.id === "dataset" || section.id === "training" },
                    React.createElement("summary", { className: "cursor-pointer list-none px-5 py-4" },
                        React.createElement("div", { className: "flex items-start justify-between gap-3" },
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700" }, section.title),
                                React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, section.description)),
                            React.createElement(Badge, { type: "ghost", className: "px-3 py-3" }, formatCount((section.fields || []).length, "field")))),
                    React.createElement("div", { className: "border-t border-base-300 px-5 py-5" },
                        React.createElement("div", { className: section.columns === 1 ? "grid gap-4" : "grid gap-4 md:grid-cols-2" }, (section.fields || []).map((field) => (React.createElement("div", { key: field.name },
                            React.createElement(FormFieldControl, { field: field, value: formValues[field.name], suggestions: suggestions[field.name] || [], onChange: onFieldChange })))))))))),
            React.createElement("div", { className: "grid gap-4" },
                React.createElement(Card, { className: "min-w-0 rounded-md border border-base-300 bg-slate-950 text-slate-100 shadow-lg" },
                    React.createElement("div", { className: "space-y-3" },
                        React.createElement("div", { className: "flex items-center justify-between gap-3" },
                            React.createElement("h3", { className: "text-lg font-bold" }, "Command"),
                            React.createElement(Badge, { type: previewBadge.type, className: "border-none px-3 py-3" }, previewBadge.label)),
                        React.createElement("pre", { className: "max-h-[320px] overflow-auto rounded-md bg-slate-900/70 p-4 text-xs leading-6 text-slate-100" }, previewError ||
                            preview?.commandDisplay ||
                            "Isi form konfigurasi untuk melihat command training."))),
                React.createElement(Card, { className: "min-w-0 rounded-md border border-base-300 bg-base-100/90 shadow-lg" },
                    React.createElement("div", { className: "space-y-4" },
                        React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                            React.createElement("h3", { className: "text-lg font-bold" }, "Preset Penting"),
                            React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, "Label aman")),
                        React.createElement("div", { className: "grid gap-3" }, presetSummary.map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-md border border-base-300 bg-base-200/50 p-3" },
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
                            React.createElement("p", { className: "text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900" }, value)))))))))));
}
