import React from "react";
import { Alert, Badge, Button, Card, Modal, Paragraph } from "../../ui.js";
import { formatCount, formatTimestamp, joinClasses } from "../../shared/utils.js";
import { formatMetric } from "../../shared/formHelpers.js";
/**
 * Training run explorer and detail view
 * Displays list of training runs and detailed metrics for selected run
 */
export function TrainingRunExplorer({ runs, selectedRun, selectedRunKey, onSelectRun, }) {
    const [isAssetModalOpen, setIsAssetModalOpen] = React.useState(false);
    const [activeImageIndex, setActiveImageIndex] = React.useState(-1);
    const imageArtifacts = React.useMemo(() => selectedRun?.imageArtifacts || selectedRun?.previewArtifacts || [], [selectedRun]);
    const activeImageArtifact = activeImageIndex >= 0 && activeImageIndex < imageArtifacts.length
        ? imageArtifacts[activeImageIndex]
        : null;
    const closeAssetGallery = () => {
        setIsAssetModalOpen(false);
        setActiveImageIndex(-1);
    };
    const showPreviousImage = () => {
        if (!imageArtifacts.length) {
            return;
        }
        setActiveImageIndex((current) => (current <= 0 ? imageArtifacts.length - 1 : current - 1));
    };
    const showNextImage = () => {
        if (!imageArtifacts.length) {
            return;
        }
        setActiveImageIndex((current) => (current >= imageArtifacts.length - 1 ? 0 : current + 1));
    };
    React.useEffect(() => {
        setActiveImageIndex(-1);
    }, [selectedRunKey]);
    React.useEffect(() => {
        if (!activeImageArtifact || typeof window === "undefined") {
            return undefined;
        }
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setActiveImageIndex(-1);
                return;
            }
            if (imageArtifacts.length <= 1) {
                return;
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                showPreviousImage();
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                showNextImage();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [activeImageArtifact, imageArtifacts.length]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "grid min-w-0 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]" },
            React.createElement(Card, { className: "h-fit min-w-0 rounded-sm border border-base-300 bg-base-100/90 shadow-xl xl:sticky xl:top-28" },
                React.createElement("div", { className: "space-y-4" },
                    React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                        React.createElement("div", null,
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700" }, "Run Explorer"),
                            React.createElement("h2", { className: "mt-2 text-xl font-bold tracking-tight" }, "Hasil Training"),
                            React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Pilih run untuk membuka detail lengkap di panel kanan.")),
                        React.createElement(Badge, { type: "success", className: "px-3 py-3" }, formatCount(runs.length, "run"))),
                    React.createElement("div", { className: "grid gap-2 overflow-auto" }, runs.length ? (runs.map((run) => (React.createElement("button", { key: run.key, type: "button", onClick: () => onSelectRun(run.key), className: joinClasses("w-full overflow-hidden rounded-sm border px-3 py-3 text-left transition duration-150", run.key === selectedRunKey
                            ? "border-warning bg-warning/10 shadow-md"
                            : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20"), title: run.key },
                        React.createElement("p", { className: "text-wrap-anywhere text-sm font-semibold leading-5 text-slate-900" }, run.key))))) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Belum ada run training di folder output."))))),
            React.createElement(Card, { className: "min-w-0 rounded-sm border border-base-300 bg-base-100/90 shadow-xl" },
                React.createElement("div", { className: "space-y-4" },
                    React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                        React.createElement("div", null,
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700" }, "Detail Run"),
                            React.createElement("h2", { className: "text-wrap-anywhere mt-2 text-xl font-bold tracking-tight" }, selectedRun ? selectedRun.key : "Belum ada run"),
                            React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Metrik terakhir, konfigurasi inti, dan artifact penting dari training.")),
                        selectedRun ? (React.createElement("div", { className: "flex flex-wrap items-center justify-end gap-2" },
                            React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-sm border border-base-300 bg-base-100 px-4", disabled: !imageArtifacts.length, onClick: () => setIsAssetModalOpen(true) },
                                "Asset (",
                                imageArtifacts.length,
                                ")"),
                            React.createElement(Badge, { type: "info", className: "px-3 py-3" }, selectedRun.totalSizeLabel))) : null),
                    selectedRun ? (React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "grid gap-3 md:grid-cols-4" },
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3 md:col-span-2" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Path"),
                                React.createElement("p", { className: "text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900" }, selectedRun.path || "-")),
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Updated"),
                                React.createElement("p", { className: "mt-2 text-base font-semibold text-slate-900" }, formatTimestamp(selectedRun.updatedAt))),
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Artifact"),
                                React.createElement("p", { className: "mt-2 text-base font-semibold text-slate-900" }, formatCount(selectedRun.fileCount ?? 0, "file")))),
                        React.createElement("div", { className: "grid gap-3 md:grid-cols-4" }, [
                            { label: "Precision", value: formatMetric(selectedRun.metrics?.lastPrecision, { percent: true }) },
                            { label: "Recall", value: formatMetric(selectedRun.metrics?.lastRecall, { percent: true }) },
                            { label: "mAP50", value: formatMetric(selectedRun.metrics?.bestMap50, { percent: true }) },
                            {
                                label: "mAP50-95",
                                value: formatMetric(selectedRun.metrics?.bestMap50_95, { percent: true }),
                                tone: "text-success",
                            },
                        ].map(({ label, value, tone }) => (React.createElement("div", { key: label, className: `rounded-sm border border-base-300 bg-base-200/40 p-3 ${tone || ""}` },
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
                            React.createElement("p", { className: "mt-2 text-base font-semibold text-slate-900" }, value))))),
                        React.createElement("div", { className: "grid gap-3 md:grid-cols-4" }, [
                            {
                                label: "Epoch",
                                value: String(selectedRun.metrics?.lastEpoch ?? "-"),
                                detail: `${selectedRun.metrics?.rowCount ?? 0} row`,
                            },
                            {
                                label: "Batch",
                                value: String(selectedRun.config?.batch ?? "-"),
                                detail: `workers ${selectedRun.config?.workers ?? "-"}`,
                            },
                            {
                                label: "Image",
                                value: String(selectedRun.config?.imgsz ?? "-"),
                                detail: `device ${selectedRun.config?.device ?? "-"}`,
                            },
                            {
                                label: "Patience",
                                value: String(selectedRun.config?.patience ?? "-"),
                                detail: `epochs ${selectedRun.config?.epochs ?? "-"}`,
                            },
                        ].map(({ label, value, detail }) => (React.createElement("div", { key: label, className: "rounded-sm border border-base-300 bg-base-200/40 p-3" },
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
                            React.createElement("p", { className: "mt-2 text-base font-semibold text-slate-900" }, value),
                            detail ? React.createElement("p", { className: "mt-1 text-[11px] text-slate-500" }, detail) : null)))),
                        React.createElement("div", { className: "grid gap-3 md:grid-cols-2" },
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Model"),
                                React.createElement("p", { className: "text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900" }, selectedRun.config?.model || "-")),
                            React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/40 p-3" },
                                React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, "Data"),
                                React.createElement("p", { className: "text-wrap-anywhere mt-2 font-mono text-[12px] text-slate-900" }, selectedRun.config?.data || "-"))),
                        React.createElement("div", { className: "flex flex-wrap gap-2" },
                            selectedRun.artifacts?.bestWeights?.downloadUrl ? (React.createElement("a", { href: selectedRun.artifacts.bestWeights.downloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-sm bg-warning px-4 py-2 text-sm font-semibold text-white hover:bg-warning/90" }, "Best Weights")) : null,
                            selectedRun.artifacts?.lastWeights?.downloadUrl ? (React.createElement("a", { href: selectedRun.artifacts.lastWeights.downloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-sm border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold hover:bg-base-200" }, "Last Weights")) : null,
                            selectedRun.artifacts?.resultsCsv?.downloadUrl ? (React.createElement("a", { href: selectedRun.artifacts.resultsCsv.downloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-sm bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90" }, "results.csv")) : null,
                            selectedRun.artifacts?.argsYaml?.downloadUrl ? (React.createElement("a", { href: selectedRun.artifacts.argsYaml.downloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-sm border border-base-300 bg-base-100 px-4 py-2 text-sm font-semibold hover:bg-base-200" }, "args.yaml")) : null),
                        (selectedRun.previewArtifacts || []).length ? (React.createElement("div", { className: "grid gap-4 lg:grid-cols-3" }, selectedRun.previewArtifacts.map((artifact) => {
                            const previewIndex = imageArtifacts.findIndex((item) => item.path === artifact.path);
                            return (React.createElement("button", { key: artifact.path, type: "button", disabled: previewIndex < 0, onClick: () => setActiveImageIndex(previewIndex), className: "overflow-hidden rounded-sm border border-base-300 bg-base-100 text-left shadow-md transition hover:-translate-y-0.5 hover:border-base-content/20 disabled:cursor-default disabled:hover:translate-y-0" },
                                React.createElement("div", { className: "border-b border-base-300 bg-slate-950" },
                                    React.createElement("img", { src: artifact.downloadUrl, alt: artifact.name, className: "aspect-[4/3] w-full object-cover", loading: "lazy" })),
                                React.createElement("div", { className: "p-4" },
                                    React.createElement("p", { className: "text-sm font-semibold text-slate-900" }, artifact.name),
                                    React.createElement("p", { className: "mt-1 text-[11px] text-slate-500" }, artifact.sizeLabel))));
                        }))) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Run ini belum memiliki artifact preview gambar.")))) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Belum ada detail run yang bisa ditampilkan."))))),
        React.createElement(Modal, { open: isAssetModalOpen, onClose: closeAssetGallery, title: selectedRun ? `Asset Run - ${selectedRun.key}` : "Asset Run", size: "xl" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3 rounded-sm border border-base-300 bg-base-200/30 p-4" },
                    React.createElement("div", { className: "min-w-0" },
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700" }, "Asset Gallery"),
                        React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Klik thumbnail untuk membuka preview fullscreen dari artifact gambar.")),
                    React.createElement(Badge, { type: "info", className: "px-3 py-2" }, formatCount(imageArtifacts.length, "image"))),
                imageArtifacts.length ? (React.createElement("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" }, imageArtifacts.map((artifact, index) => (React.createElement("button", { key: artifact.path, type: "button", onClick: () => setActiveImageIndex(index), className: "group overflow-hidden rounded-sm border border-base-300 bg-base-100 text-left shadow-md transition duration-150 hover:-translate-y-0.5 hover:border-base-content/20" },
                    React.createElement("div", { className: "overflow-hidden border-b border-base-300 bg-slate-950" },
                        React.createElement("img", { src: artifact.downloadUrl, alt: artifact.name, className: "aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.02]", loading: "lazy" })),
                    React.createElement("div", { className: "space-y-1 p-3" },
                        React.createElement("p", { className: "truncate text-sm font-semibold text-slate-900" }, artifact.name),
                        React.createElement("p", { className: "text-[11px] text-slate-500" }, artifact.sizeLabel),
                        React.createElement("p", { className: "text-[11px] text-slate-500" }, formatTimestamp(artifact.modifiedAt)))))))) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Run ini belum memiliki asset gambar yang bisa ditampilkan.")))),
        activeImageArtifact ? (React.createElement("div", { className: "fixed inset-0 z-[1200] bg-slate-950/95 p-4 md:p-6", onClick: () => setActiveImageIndex(-1) },
            React.createElement("div", { className: "flex h-full flex-col gap-4", onClick: (event) => event.stopPropagation() },
                React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                    React.createElement("div", { className: "min-w-0 text-white" },
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200" }, "Asset Preview"),
                        React.createElement("h3", { className: "text-wrap-anywhere mt-2 text-xl font-bold" }, activeImageArtifact.name),
                        React.createElement("p", { className: "mt-2 text-xs text-slate-300" },
                            activeImageArtifact.sizeLabel,
                            " \u2022 ",
                            formatTimestamp(activeImageArtifact.modifiedAt),
                            " \u2022",
                            " ",
                            activeImageIndex + 1,
                            "/",
                            imageArtifacts.length)),
                    React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                        imageArtifacts.length > 1 ? (React.createElement(React.Fragment, null,
                            React.createElement("button", { type: "button", className: "rounded-sm border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15", onClick: showPreviousImage }, "Prev"),
                            React.createElement("button", { type: "button", className: "rounded-sm border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15", onClick: showNextImage }, "Next"))) : null,
                        React.createElement("a", { href: activeImageArtifact.downloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-sm border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15" }, "Buka Tab Baru"),
                        React.createElement("button", { type: "button", className: "rounded-sm bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100", onClick: () => setActiveImageIndex(-1) }, "Tutup"))),
                React.createElement("div", { className: "flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-sm border border-white/10 bg-black/40 p-3 md:p-6" },
                    React.createElement("img", { src: activeImageArtifact.downloadUrl, alt: activeImageArtifact.name, className: "max-h-full max-w-full object-contain" }))))) : null));
}
