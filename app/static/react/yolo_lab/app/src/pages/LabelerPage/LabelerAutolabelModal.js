import React from "react";
import { PathInput } from "../../components/PathInput.js";
import { Alert, Button, Modal, Paragraph } from "../../ui.js";
export function LabelerAutolabelModal({ open, onClose, activeFramesDir, totalImages, currentImageName, autolabelConfig, autolabelSuggestions, autolabelWarnings, job, onAutolabelConfigChange, onAutolabelCurrent, onAutolabelAll, }) {
    const modelValue = String(autolabelConfig.model || "");
    const isRunning = Boolean(job?.running);
    return (React.createElement(Modal, { open: open, onClose: onClose, title: "Auto Labeling", size: "xl", actions: (React.createElement(React.Fragment, null,
            React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, className: "rounded-sm", onClick: onClose }, "Tutup"),
            React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm", disabled: !currentImageName || !modelValue.trim() || isRunning, onClick: onAutolabelCurrent }, "Auto-label frame ini"),
            React.createElement(Button, { variant: "warning", isSubmit: false, className: "rounded-sm", disabled: !totalImages || !modelValue.trim() || isRunning, onClick: onAutolabelAll }, "Auto-label semua frame"))) },
        React.createElement("div", { className: "space-y-4" },
            React.createElement("div", { className: "grid gap-3 sm:grid-cols-3" },
                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Folder aktif"),
                    React.createElement("strong", { className: "mt-2 block break-all text-slate-900" }, activeFramesDir || "-")),
                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Total frame"),
                    React.createElement("strong", { className: "mt-2 block text-slate-900" }, totalImages || 0)),
                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Frame aktif"),
                    React.createElement("strong", { className: "mt-2 block break-all text-slate-900" }, currentImageName || "Belum ada"))),
            React.createElement(PathInput, { name: "autolabel-model", label: "Auto-label model", placeholder: "model/yolo26x.pt", helpText: "Path file `.pt` lokal atau nama model Ultralytics untuk membuat label awal otomatis. Model yang lebih cocok dengan domain data biasanya memberi box awal yang lebih rapi, tetapi hasilnya tetap perlu dicek manual.", value: modelValue, onChange: (newValue) => onAutolabelConfigChange({
                    ...autolabelConfig,
                    model: newValue,
                }), suggestions: autolabelSuggestions, disabled: isRunning }),
            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/30 p-4" },
                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Alur kerja"),
                React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Gunakan tombol frame aktif untuk refresh label pada gambar yang sedang dibuka. Tombol semua frame akan memproses seluruh folder aktif dan melewati label yang sudah ada agar hasil manual tetap aman.")),
            isRunning ? (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Auto-label sedang berjalan. Panel labeling dikunci sementara dan output proses bisa dipantau dari log runner di bawah.")) : null,
            autolabelWarnings.length ? (React.createElement(Alert, { type: "warning", className: "rounded-sm text-sm" },
                React.createElement("div", { className: "space-y-2" }, autolabelWarnings.map((warning) => (React.createElement("p", { key: warning }, warning)))))) : null)));
}
