import React, { useEffect, useMemo, useState } from "react";
import { PathInput } from "../../components/PathInput.js";
import { joinClasses } from "../../shared/utils.js";
import { Alert, Badge, Button, Input, Paragraph } from "../../ui.js";
const FRAME_GRID_BATCH_SIZE = 120;
function frameStatus(item) {
    if (item.parseError) {
        return { type: "error", label: "Label invalid" };
    }
    if (item.hasLabelFile) {
        return { type: "success", label: "Sudah ada label" };
    }
    return { type: "ghost", label: "Belum ada label" };
}
export function LabelerAutolabelModal({ open, onClose, activeFramesDir, images, visibleImages, totalImages, currentImageName, selectedImageNames, autolabelConfig, autolabelSuggestions, autolabelWarnings, job, onAutolabelConfigChange, onSelectCurrentImage, onSelectVisibleImages, onSelectPendingImages, onClearSelection, onToggleImageSelection, onAutolabelCurrent, onAutolabelSelection, onAutolabelAll, }) {
    const [visiblePreviewCount, setVisiblePreviewCount] = useState(FRAME_GRID_BATCH_SIZE);
    const modelValue = String(autolabelConfig.model || "");
    const isRunning = Boolean(job?.running);
    const selectedCount = selectedImageNames.length;
    const imageLookup = useMemo(() => new Map((images || []).map((item) => [item.name, item])), [images]);
    const selectionSet = useMemo(() => new Set(selectedImageNames || []), [selectedImageNames]);
    const pendingVisibleImages = useMemo(() => (visibleImages || []).filter((item) => !item.hasLabelFile), [visibleImages]);
    const renderedVisibleImages = useMemo(() => (visibleImages || []).slice(0, visiblePreviewCount), [visibleImages, visiblePreviewCount]);
    const selectedVisibleCount = useMemo(() => (visibleImages || []).reduce((count, item) => count + (selectionSet.has(item.name) ? 1 : 0), 0), [visibleImages, selectionSet]);
    const selectedExistingLabelCount = useMemo(() => selectedImageNames.reduce((count, imageName) => count + (imageLookup.get(imageName)?.hasLabelFile ? 1 : 0), 0), [selectedImageNames, imageLookup]);
    const hasMoreVisibleImages = renderedVisibleImages.length < (visibleImages || []).length;
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        setVisiblePreviewCount(FRAME_GRID_BATCH_SIZE);
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose, activeFramesDir]);
    if (!open) {
        return null;
    }
    return (React.createElement("div", { className: "fixed inset-0 z-[70]" },
        React.createElement("div", { className: "absolute inset-0 bg-slate-950/55 backdrop-blur-sm", onClick: onClose, "aria-hidden": "true" }),
        React.createElement("div", { className: "relative flex h-full items-center justify-center p-3 md:p-6" },
            React.createElement("div", { className: "flex h-[min(92vh,980px)] w-[min(96vw,1540px)] flex-col overflow-hidden rounded-sm border border-slate-200 bg-base-100 shadow-2xl", onClick: (event) => event.stopPropagation() },
                React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-4 border-b border-base-300 px-5 py-4 md:px-6" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700" }, "Auto Label Workspace"),
                        React.createElement("h2", { className: "mt-2 text-2xl font-bold tracking-tight text-slate-900" }, "Sidebar form + mainbar frame selection"),
                        React.createElement(Paragraph, { className: "mt-2 max-w-3xl text-sm leading-6 opacity-100" }, "Form auto-label tetap di kiri, sedangkan grid kanan mengikuti folder aktif dan filter frame di labeler agar kita bisa memilih banyak target sekaligus sebelum menjalankan inferensi.")),
                    React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, className: "rounded-sm", onClick: onClose }, "Tutup")),
                React.createElement("div", { className: "grid min-h-0 flex-1 xl:grid-cols-[390px_minmax(0,1fr)]" },
                    React.createElement("aside", { className: "min-h-0 overflow-y-auto border-b border-base-300 bg-base-100 xl:border-b-0 xl:border-r" },
                        React.createElement("div", { className: "space-y-4 p-5" },
                            React.createElement("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-1" },
                                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Folder aktif"),
                                    React.createElement("strong", { className: "mt-2 block break-all text-slate-900" }, activeFramesDir || "-")),
                                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Total frame"),
                                    React.createElement("strong", { className: "mt-2 block text-slate-900" }, totalImages || 0)),
                                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Frame aktif"),
                                    React.createElement("strong", { className: "mt-2 block break-all text-slate-900" }, currentImageName || "Belum ada")),
                                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm" },
                                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Frame terpilih"),
                                    React.createElement("strong", { className: "mt-2 block text-slate-900" }, selectedCount),
                                    React.createElement("p", { className: "mt-1 text-xs text-slate-500" },
                                        selectedVisibleCount,
                                        " dari hasil filter saat ini"))),
                            React.createElement(PathInput, { name: "autolabel-model", label: "Auto-label model", placeholder: "model/yolo26x.pt", helpText: "Path file `.pt` lokal atau nama model Ultralytics untuk membuat label awal otomatis. Model yang lebih cocok dengan domain data biasanya memberi box awal yang lebih rapi, tetapi hasilnya tetap perlu dicek manual.", value: modelValue, onChange: (newValue) => onAutolabelConfigChange({
                                    ...autolabelConfig,
                                    model: newValue,
                                }), suggestions: autolabelSuggestions, disabled: isRunning }),
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/30 p-4" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Tuning YOLO"),
                                React.createElement("div", { className: "mt-4 grid gap-4" },
                                    React.createElement(Input, { name: "autolabel-conf", label: "Confidence threshold", type: "number", step: "0.01", min: "0.01", max: "0.99", helpText: "Naikkan jika box liar atau duplikat terlalu banyak. Turunkan jika banyak objek valid justru hilang.", value: String(autolabelConfig.conf ?? ""), onChange: (event) => onAutolabelConfigChange({
                                            ...autolabelConfig,
                                            conf: event.target.value,
                                        }), disabled: isRunning }),
                                    React.createElement(Input, { name: "autolabel-iou", label: "IoU / NMS threshold", type: "number", step: "0.01", min: "0.01", max: "0.99", helpText: "Turunkan untuk NMS yang lebih agresif saat dua box saling tumpang tindih pada objek yang sama.", value: String(autolabelConfig.iou ?? ""), onChange: (event) => onAutolabelConfigChange({
                                            ...autolabelConfig,
                                            iou: event.target.value,
                                        }), disabled: isRunning }),
                                    React.createElement(Input, { name: "autolabel-imgsz", label: "Image size", type: "number", step: "32", min: "32", helpText: "Ukuran inferensi YOLO saat auto-label. Nilai lebih besar membantu objek kecil tetapi proses jadi lebih berat.", value: String(autolabelConfig.imgsz ?? ""), onChange: (event) => onAutolabelConfigChange({
                                            ...autolabelConfig,
                                            imgsz: event.target.value,
                                        }), disabled: isRunning }),
                                    React.createElement(Input, { name: "autolabel-device", label: "Device", placeholder: "auto / cpu / cuda:0", helpText: "Perangkat inferensi YOLO untuk auto-label.", value: String(autolabelConfig.device ?? ""), onChange: (event) => onAutolabelConfigChange({
                                            ...autolabelConfig,
                                            device: event.target.value,
                                        }), disabled: isRunning }))),
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/30 p-4" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Filter Double Detect"),
                                React.createElement("p", { className: "mt-2 text-sm leading-6 text-slate-600" }, "Aktifkan filter ini untuk membuang box person yang lebih kecil tetapi hampir seluruhnya menempel di dalam box person yang lebih besar, seperti kasus torso + full body pada orang yang sama."),
                                React.createElement("div", { className: "mt-4 grid gap-4" },
                                    React.createElement("div", { className: "form-control w-full" },
                                        React.createElement("label", { className: "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-base-300 bg-base-100/80 px-4 transition-colors hover:border-base-content/20" },
                                            React.createElement("input", { type: "checkbox", name: "autolabel-suppress-nested-duplicates", checked: Boolean(autolabelConfig.suppressNestedDuplicates), className: "checkbox checkbox-primary", onChange: (event) => onAutolabelConfigChange({
                                                    ...autolabelConfig,
                                                    suppressNestedDuplicates: event.target.checked,
                                                }), disabled: isRunning }),
                                            React.createElement("div", { className: "text-sm text-base-content/80" },
                                                React.createElement("p", { className: "font-medium text-slate-900" }, "Suppress nested duplicate person boxes"),
                                                React.createElement("p", { className: "text-xs text-slate-500" }, "Cocok untuk mengurangi double detect orang yang sama pada auto-labeling.")))),
                                    Boolean(autolabelConfig.suppressNestedDuplicates) && (React.createElement(Input, { name: "autolabel-duplicate-containment-threshold", label: "Duplicate containment threshold", type: "number", step: "0.01", min: "0.5", max: "1", helpText: "Semakin kecil nilainya, filter makin agresif menganggap dua box sebagai duplikat nested.", value: String(autolabelConfig.duplicateContainmentThreshold ?? ""), onChange: (event) => onAutolabelConfigChange({
                                            ...autolabelConfig,
                                            duplicateContainmentThreshold: event.target.value,
                                        }), disabled: isRunning })))),
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/30 p-4" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Aksi auto-label"),
                                React.createElement("div", { className: "mt-4 grid gap-2" },
                                    React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm justify-start", disabled: !currentImageName || !modelValue.trim() || isRunning, onClick: onAutolabelCurrent }, "Auto-label frame aktif"),
                                    React.createElement(Button, { variant: "warning", isSubmit: false, className: "rounded-sm justify-start", disabled: !selectedCount || !modelValue.trim() || isRunning, onClick: onAutolabelSelection }, "Auto-label frame terpilih"),
                                    React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm justify-start", disabled: !totalImages || !modelValue.trim() || isRunning, onClick: onAutolabelAll }, "Auto-label semua frame")),
                                React.createElement(Paragraph, { className: "mt-3 text-sm leading-6 opacity-100" }, "`frame aktif` dan `frame terpilih` akan me-refresh label target. `semua frame` tetap aman untuk batch besar karena label yang sudah ada akan dipertahankan.")),
                            isRunning ? (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Auto-label sedang berjalan. Kamu masih bisa meninjau pilihan frame di panel kanan, tetapi proses berikutnya baru bisa dijalankan setelah job sekarang selesai.")) : null,
                            selectedCount > 0 && selectedExistingLabelCount > 0 ? (React.createElement(Alert, { type: "warning", className: "rounded-sm text-sm" },
                                selectedExistingLabelCount,
                                " frame terpilih sudah punya label dan akan di-refresh saat menjalankan mode selection.")) : null,
                            autolabelWarnings.length ? (React.createElement(Alert, { type: "warning", className: "rounded-sm text-sm" },
                                React.createElement("div", { className: "space-y-2" }, autolabelWarnings.map((warning) => (React.createElement("p", { key: warning }, warning)))))) : null)),
                    React.createElement("section", { className: "min-h-0 bg-slate-50/40" },
                        React.createElement("div", { className: "flex h-full min-h-0 flex-col" },
                            React.createElement("div", { className: "border-b border-base-300 bg-base-100/80 px-5 py-4" },
                                React.createElement("div", { className: "flex flex-col gap-4" },
                                    React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                                        React.createElement("div", null,
                                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Mainbar Frame Grid"),
                                            React.createElement("h3", { className: "mt-2 text-xl font-bold text-slate-900" }, "Pilih banyak frame untuk auto-label"),
                                            React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Grid ini memakai hasil filter dan pencarian yang sedang aktif di sidebar labeler. Klik kartu frame untuk menambah atau menghapusnya dari selection.")),
                                        React.createElement("div", { className: "flex flex-wrap gap-2" },
                                            React.createElement(Badge, { type: "info", className: "px-3 py-3" },
                                                "Terlihat: ",
                                                visibleImages.length),
                                            React.createElement(Badge, { type: "warning", className: "px-3 py-3" },
                                                "Terpilih: ",
                                                selectedCount),
                                            React.createElement(Badge, { type: "ghost", className: "px-3 py-3" },
                                                "Pending: ",
                                                pendingVisibleImages.length))),
                                    React.createElement("div", { className: "flex flex-wrap gap-2" },
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !currentImageName, onClick: onSelectCurrentImage }, "Pilih frame aktif"),
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !visibleImages.length, onClick: onSelectVisibleImages }, "Pilih semua terlihat"),
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !pendingVisibleImages.length, onClick: onSelectPendingImages }, "Pilih pending"),
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !selectedCount, onClick: onClearSelection }, "Reset selection")))),
                            React.createElement("div", { className: "min-h-0 flex-1 overflow-y-auto p-5" }, visibleImages.length ? (React.createElement(React.Fragment, null,
                                visibleImages.length > visiblePreviewCount ? (React.createElement(Alert, { type: "info", className: "mb-4 rounded-sm text-sm" },
                                    "Menampilkan ",
                                    renderedVisibleImages.length,
                                    " dari ",
                                    visibleImages.length,
                                    " frame agar grid tetap ringan. Tombol load more tersedia di bawah.")) : null,
                                React.createElement("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" }, renderedVisibleImages.map((item) => {
                                    const isSelected = selectionSet.has(item.name);
                                    const isCurrent = item.name === currentImageName;
                                    const status = frameStatus(item);
                                    return (React.createElement("button", { key: item.name, type: "button", "aria-pressed": isSelected, onClick: () => onToggleImageSelection(item.name), className: joinClasses("group overflow-hidden rounded-sm border bg-base-100 text-left transition duration-150", isSelected
                                            ? "border-warning bg-warning/10 shadow-lg ring-1 ring-warning/40"
                                            : "border-base-300 hover:-translate-y-0.5 hover:border-base-content/20 hover:shadow-md", isCurrent && !isSelected ? "border-info/70 ring-1 ring-info/20" : "") },
                                        React.createElement("div", { className: "relative aspect-video overflow-hidden bg-slate-200" },
                                            React.createElement("img", { src: `/frames/${encodeURIComponent(item.name)}`, alt: item.name, loading: "lazy", className: "h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" }),
                                            React.createElement("div", { className: "absolute left-3 top-3 flex flex-wrap gap-2" },
                                                isSelected ? (React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, "Dipilih")) : null,
                                                isCurrent ? (React.createElement(Badge, { type: "info", className: "px-3 py-3" }, "Frame aktif")) : null)),
                                        React.createElement("div", { className: "space-y-3 p-4" },
                                            React.createElement("div", { className: "flex items-start justify-between gap-3" },
                                                React.createElement("p", { className: "line-clamp-2 break-all text-sm font-semibold text-slate-900" }, item.name),
                                                React.createElement(Badge, { type: isSelected ? "warning" : "ghost", className: "px-3 py-3" },
                                                    item.boxCount || 0,
                                                    " box")),
                                            React.createElement("div", { className: "flex flex-wrap gap-2" },
                                                React.createElement(Badge, { type: status.type, className: "px-3 py-3" }, status.label),
                                                item.isCheckpoint ? (React.createElement(Badge, { type: "warning", outline: true, className: "px-3 py-3" }, "Checkpoint")) : null))));
                                })),
                                hasMoreVisibleImages ? (React.createElement("div", { className: "mt-5 flex justify-center" },
                                    React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, className: "rounded-sm", onClick: () => setVisiblePreviewCount((current) => Math.min(current + FRAME_GRID_BATCH_SIZE, visibleImages.length)) },
                                        "Tampilkan ",
                                        Math.min(FRAME_GRID_BATCH_SIZE, visibleImages.length - visiblePreviewCount),
                                        " frame lagi"))) : null)) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Tidak ada frame aktif yang cocok dengan filter dan pencarian saat ini."))))))))));
}
