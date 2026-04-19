import React from "react";
import { Badge, Button, Card } from "../../ui.js";
import { fileSizeLabel, formatCount } from "../../shared/utils.js";
export function FootageImportPanel({ fileInputRef, selectedFiles, isImporting, targetDir, onFileChange, onImport, }) {
    return (React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                React.createElement("div", null,
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500" }, "Import Footage"),
                    React.createElement("h3", { className: "mt-1 text-lg font-bold tracking-tight text-slate-900" }, "Tambah video ke workspace")),
                React.createElement(Badge, { type: "info", className: "px-3 py-3" }, formatCount(selectedFiles.length, "file dipilih"))),
            React.createElement("div", { className: "rounded-sm border border-dashed border-base-300 bg-base-200/30 p-4" },
                React.createElement("p", { className: "text-sm text-slate-700" },
                    "Target import:",
                    React.createElement("span", { className: "ml-2 font-mono text-[12px] font-semibold text-slate-900" }, targetDir)),
                React.createElement("p", { className: "mt-2 text-xs text-slate-500" }, "Format yang didukung: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`"),
                React.createElement("input", { ref: fileInputRef, type: "file", accept: ".mp4,.avi,.mov,.mkv,.webm,video/*", multiple: true, className: "file-input file-input-bordered mt-4 w-full", onChange: onFileChange })),
            selectedFiles.length > 0 ? (React.createElement("div", { className: "grid gap-2" },
                selectedFiles.slice(0, 5).map((file) => (React.createElement("div", { key: `${file.name}-${file.size}-${file.lastModified}`, className: "flex items-center justify-between gap-3 rounded-sm border border-base-300 bg-base-100 px-3 py-2" },
                    React.createElement("div", { className: "min-w-0" },
                        React.createElement("p", { className: "truncate text-sm font-semibold text-slate-900" }, file.name),
                        React.createElement("p", { className: "text-xs text-slate-500" }, file.type || "video")),
                    React.createElement(Badge, { type: "ghost", className: "px-3 py-2" }, fileSizeLabel(file.size))))),
                selectedFiles.length > 5 ? (React.createElement("p", { className: "text-xs text-slate-500" },
                    "dan ",
                    selectedFiles.length - 5,
                    " file lain akan ikut diimport.")) : null)) : null,
            React.createElement("div", { className: "flex justify-end" },
                React.createElement(Button, { variant: "info", isSubmit: false, className: "rounded-sm px-5", disabled: !selectedFiles.length, loading: isImporting, onClick: onImport }, "Import Footage")))));
}
