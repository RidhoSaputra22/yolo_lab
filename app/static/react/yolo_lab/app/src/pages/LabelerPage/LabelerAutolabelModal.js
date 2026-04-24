import React, { useEffect, useMemo, useRef, useState } from "react";
import { PathInput } from "../../components/PathInput.js";
import { joinClasses } from "../../shared/utils.js";
import { Alert, Badge, Button, Input, Paragraph } from "../../ui.js";
const FRAME_GRID_BATCH_SIZE = 120;
const DRAG_SELECT_THRESHOLD = 12;
const DRAG_SCROLL_EDGE_SIZE = 48;
const DRAG_SCROLL_MAX_STEP = 18;
function isTextInputElement(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    if (target.isContentEditable) {
        return true;
    }
    const tagName = String(target.tagName || "").toLowerCase();
    return tagName === "input" || tagName === "textarea" || tagName === "select";
}
function clampToRange(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function rectanglesIntersect(rectA, rectB) {
    return !(rectA.right < rectB.left ||
        rectA.left > rectB.right ||
        rectA.bottom < rectB.top ||
        rectA.top > rectB.bottom);
}
function buildSelectionRect(startPoint, endPoint, containerRect) {
    const startX = clampToRange(startPoint.x, containerRect.left, containerRect.right);
    const startY = clampToRange(startPoint.y, containerRect.top, containerRect.bottom);
    const endX = clampToRange(endPoint.x, containerRect.left, containerRect.right);
    const endY = clampToRange(endPoint.y, containerRect.top, containerRect.bottom);
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const right = Math.max(startX, endX);
    const bottom = Math.max(startY, endY);
    return {
        clientRect: {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
        },
        overlayRect: {
            left: left - containerRect.left,
            top: top - containerRect.top,
            width: right - left,
            height: bottom - top,
        },
    };
}
function imageNameSetsEqual(leftNames, rightNames) {
    if (leftNames.size !== rightNames.size) {
        return false;
    }
    for (const imageName of leftNames) {
        if (!rightNames.has(imageName)) {
            return false;
        }
    }
    return true;
}
function getImageRangeNames(imageNames, startImageName, endImageName) {
    const startIndex = imageNames.indexOf(startImageName);
    const endIndex = imageNames.indexOf(endImageName);
    if (startIndex < 0 || endIndex < 0) {
        return [];
    }
    const rangeStart = Math.min(startIndex, endIndex);
    const rangeEnd = Math.max(startIndex, endIndex);
    return imageNames.slice(rangeStart, rangeEnd + 1);
}
function mergeUniqueImageNames(...collections) {
    return Array.from(new Set(collections.flatMap((collection) => Array.isArray(collection)
        ? collection
        : collection instanceof Set
            ? Array.from(collection)
            : [])));
}
function frameStatus(item) {
    if (item.parseError) {
        return { type: "error", label: "Label invalid" };
    }
    if (item.hasLabelFile) {
        return { type: "success", label: "Sudah ada label" };
    }
    return { type: "ghost", label: "Belum ada label" };
}
export function LabelerAutolabelModal({ open, onClose, activeFramesDir, images, visibleImages, totalImages, currentImageName, selectedImageNames, autolabelConfig, autolabelSuggestions, autolabelWarnings, job, onAutolabelConfigChange, onReplaceSelection, onSelectCurrentImage, onSelectVisibleImages, onSelectPendingImages, onClearSelection, onToggleImageSelection, onAutolabelCurrent, onAutolabelSelection, onAutolabelAll, }) {
    const [visiblePreviewCount, setVisiblePreviewCount] = useState(FRAME_GRID_BATCH_SIZE);
    const [scrollTargetImageName, setScrollTargetImageName] = useState(null);
    const [dragSelectionRect, setDragSelectionRect] = useState(null);
    const imageCardRefs = useRef(new Map());
    const mainbarViewportRef = useRef(null);
    const dragSelectionStateRef = useRef(null);
    const dragSelectionCleanupRef = useRef(null);
    const dragSelectionSetRef = useRef(new Set());
    const selectionAnchorImageNameRef = useRef(null);
    const suppressCardClickUntilRef = useRef(0);
    const modelValue = String(autolabelConfig.model || "");
    const isRunning = Boolean(job?.running);
    const selectedCount = selectedImageNames.length;
    const imageLookup = useMemo(() => new Map((images || []).map((item) => [item.name, item])), [images]);
    const selectionSet = useMemo(() => new Set(selectedImageNames || []), [selectedImageNames]);
    const pendingVisibleImages = useMemo(() => (visibleImages || []).filter((item) => !item.hasLabelFile), [visibleImages]);
    const visibleImageNames = useMemo(() => (visibleImages || []).map((item) => item.name), [visibleImages]);
    const renderedVisibleImages = useMemo(() => (visibleImages || []).slice(0, visiblePreviewCount), [visibleImages, visiblePreviewCount]);
    const selectedVisibleCount = useMemo(() => (visibleImages || []).reduce((count, item) => count + (selectionSet.has(item.name) ? 1 : 0), 0), [visibleImages, selectionSet]);
    const selectedExistingLabelCount = useMemo(() => selectedImageNames.reduce((count, imageName) => count + (imageLookup.get(imageName)?.hasLabelFile ? 1 : 0), 0), [selectedImageNames, imageLookup]);
    const currentVisibleImageIndex = useMemo(() => (visibleImages || []).findIndex((item) => item.name === currentImageName), [visibleImages, currentImageName]);
    const hasMoreVisibleImages = renderedVisibleImages.length < (visibleImages || []).length;
    const setSelectionAnchor = (imageName) => {
        const normalizedImageName = String(imageName || "").trim();
        selectionAnchorImageNameRef.current = visibleImageNames.includes(normalizedImageName)
            ? normalizedImageName
            : null;
    };
    const getFallbackAnchorImageName = () => {
        if (currentImageName && visibleImageNames.includes(currentImageName)) {
            return currentImageName;
        }
        const lastSelectedVisibleImageName = [...selectedImageNames]
            .reverse()
            .find((imageName) => visibleImageNames.includes(imageName));
        return lastSelectedVisibleImageName || visibleImageNames[0] || null;
    };
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        setVisiblePreviewCount(FRAME_GRID_BATCH_SIZE);
        setScrollTargetImageName(null);
        setDragSelectionRect(null);
        dragSelectionCleanupRef.current?.();
        dragSelectionCleanupRef.current = null;
        dragSelectionStateRef.current = null;
        dragSelectionSetRef.current = new Set();
        selectionAnchorImageNameRef.current = getFallbackAnchorImageName();
    }, [open, activeFramesDir]);
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
                return;
            }
            if (isTextInputElement(event.target)) {
                return;
            }
            if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "a") {
                event.preventDefault();
                handleSelectVisibleImages();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose, handleSelectVisibleImages]);
    useEffect(() => () => {
        dragSelectionCleanupRef.current?.();
        dragSelectionCleanupRef.current = null;
    }, []);
    useEffect(() => {
        if (selectionAnchorImageNameRef.current &&
            visibleImageNames.includes(selectionAnchorImageNameRef.current)) {
            return;
        }
        selectionAnchorImageNameRef.current = getFallbackAnchorImageName();
    }, [visibleImageNames, selectedImageNames, currentImageName]);
    useEffect(() => {
        if (!dragSelectionRect) {
            return undefined;
        }
        const previousUserSelect = document.body.style.userSelect;
        const previousCursor = document.body.style.cursor;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "crosshair";
        return () => {
            document.body.style.userSelect = previousUserSelect;
            document.body.style.cursor = previousCursor;
        };
    }, [dragSelectionRect]);
    useEffect(() => {
        if (!scrollTargetImageName) {
            return;
        }
        const targetCard = imageCardRefs.current.get(scrollTargetImageName);
        if (!targetCard) {
            return;
        }
        targetCard.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
        });
        targetCard.focus({ preventScroll: true });
        setScrollTargetImageName(null);
    }, [renderedVisibleImages, scrollTargetImageName]);
    const handleSelectCurrentImage = () => {
        onSelectCurrentImage();
        setSelectionAnchor(currentImageName);
        if (!currentImageName || currentVisibleImageIndex < 0) {
            setScrollTargetImageName(null);
            return;
        }
        const requiredVisibleCount = Math.min(visibleImages.length, Math.max(FRAME_GRID_BATCH_SIZE, Math.ceil((currentVisibleImageIndex + 1) / FRAME_GRID_BATCH_SIZE) * FRAME_GRID_BATCH_SIZE));
        setVisiblePreviewCount((current) => Math.max(current, requiredVisibleCount));
        setScrollTargetImageName(currentImageName);
    };
    function handleSelectVisibleImages() {
        onSelectVisibleImages();
        setSelectionAnchor(currentImageName && visibleImageNames.includes(currentImageName)
            ? currentImageName
            : visibleImageNames[0] || null);
    }
    const handleSelectPendingImages = () => {
        onSelectPendingImages();
        setSelectionAnchor(pendingVisibleImages.find((item) => item.name === currentImageName)?.name ||
            pendingVisibleImages[0]?.name ||
            null);
    };
    const handleClearVisibleSelection = () => {
        onClearSelection();
        selectionAnchorImageNameRef.current = null;
    };
    const resolveDragSelection = (clientRect, dragState) => {
        const hitImageNames = renderedVisibleImages.reduce((nextSelection, item) => {
            const cardNode = imageCardRefs.current.get(item.name);
            if (!cardNode) {
                return nextSelection;
            }
            if (rectanglesIntersect(clientRect, cardNode.getBoundingClientRect())) {
                nextSelection.add(item.name);
            }
            return nextSelection;
        }, new Set());
        const nextSelection = dragState.additive
            ? new Set([...dragState.baseSelection, ...hitImageNames])
            : hitImageNames;
        if (!imageNameSetsEqual(dragSelectionSetRef.current, nextSelection)) {
            dragSelectionSetRef.current = nextSelection;
            onReplaceSelection(Array.from(nextSelection));
        }
        if (dragState.originImageName) {
            setSelectionAnchor(dragState.originImageName);
        }
    };
    const finishDragSelection = ({ shouldSuppressClick = false } = {}) => {
        const dragState = dragSelectionStateRef.current;
        if (!dragState) {
            return;
        }
        if (dragState.active && shouldSuppressClick) {
            suppressCardClickUntilRef.current = performance.now() + 250;
        }
        dragSelectionCleanupRef.current?.();
        dragSelectionCleanupRef.current = null;
        dragSelectionStateRef.current = null;
        dragSelectionSetRef.current = new Set();
        setDragSelectionRect(null);
    };
    const getAutoScrollDelta = (pointerY, viewportRect) => {
        if (pointerY < viewportRect.top) {
            return -DRAG_SCROLL_MAX_STEP;
        }
        if (pointerY > viewportRect.bottom) {
            return DRAG_SCROLL_MAX_STEP;
        }
        const topDistance = pointerY - viewportRect.top;
        if (topDistance < DRAG_SCROLL_EDGE_SIZE) {
            const ratio = (DRAG_SCROLL_EDGE_SIZE - topDistance) / DRAG_SCROLL_EDGE_SIZE;
            return -Math.max(1, Math.round(ratio * DRAG_SCROLL_MAX_STEP));
        }
        const bottomDistance = viewportRect.bottom - pointerY;
        if (bottomDistance < DRAG_SCROLL_EDGE_SIZE) {
            const ratio = (DRAG_SCROLL_EDGE_SIZE - bottomDistance) / DRAG_SCROLL_EDGE_SIZE;
            return Math.max(1, Math.round(ratio * DRAG_SCROLL_MAX_STEP));
        }
        return 0;
    };
    const handleGridMouseDown = (event) => {
        if (event.button !== 0 || !mainbarViewportRef.current) {
            return;
        }
        dragSelectionCleanupRef.current?.();
        dragSelectionStateRef.current = {
            startPoint: {
                x: event.clientX,
                y: event.clientY,
            },
            baseSelection: new Set(selectedImageNames),
            additive: event.shiftKey || event.ctrlKey || event.metaKey,
            originImageName: event.target instanceof Element
                ? event.target.closest("[data-image-name]")?.getAttribute("data-image-name")
                : null,
            active: false,
        };
        dragSelectionSetRef.current = new Set(selectedImageNames);
        const handleWindowMouseMove = (moveEvent) => {
            const dragState = dragSelectionStateRef.current;
            const viewportNode = mainbarViewportRef.current;
            if (!dragState || !viewportNode) {
                return;
            }
            const currentPoint = {
                x: moveEvent.clientX,
                y: moveEvent.clientY,
            };
            const movedEnough = Math.abs(currentPoint.x - dragState.startPoint.x) >= DRAG_SELECT_THRESHOLD ||
                Math.abs(currentPoint.y - dragState.startPoint.y) >= DRAG_SELECT_THRESHOLD;
            if (!dragState.active && !movedEnough) {
                return;
            }
            dragState.active = true;
            const viewportRect = viewportNode.getBoundingClientRect();
            const autoScrollDelta = getAutoScrollDelta(currentPoint.y, viewportRect);
            if (autoScrollDelta !== 0) {
                viewportNode.scrollTop += autoScrollDelta;
            }
            const nextRect = buildSelectionRect(dragState.startPoint, currentPoint, viewportNode.getBoundingClientRect());
            if (moveEvent.cancelable) {
                moveEvent.preventDefault();
            }
            setDragSelectionRect(nextRect.overlayRect);
            resolveDragSelection(nextRect.clientRect, dragState);
        };
        const handleWindowMouseUp = () => {
            finishDragSelection({ shouldSuppressClick: true });
        };
        const handleWindowBlur = () => {
            finishDragSelection();
        };
        dragSelectionCleanupRef.current = () => {
            window.removeEventListener("mousemove", handleWindowMouseMove);
            window.removeEventListener("mouseup", handleWindowMouseUp);
            window.removeEventListener("blur", handleWindowBlur);
        };
        window.addEventListener("mousemove", handleWindowMouseMove, { passive: false });
        window.addEventListener("mouseup", handleWindowMouseUp);
        window.addEventListener("blur", handleWindowBlur);
    };
    const handleImageCardClick = (event, imageName) => {
        if (performance.now() < suppressCardClickUntilRef.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const normalizedImageName = String(imageName || "").trim();
        if (!normalizedImageName) {
            return;
        }
        const isRangeSelection = event.shiftKey;
        const isToggleSelection = event.ctrlKey || event.metaKey;
        if (isRangeSelection) {
            const anchorImageName = selectionAnchorImageNameRef.current && visibleImageNames.includes(selectionAnchorImageNameRef.current)
                ? selectionAnchorImageNameRef.current
                : getFallbackAnchorImageName() || normalizedImageName;
            const rangedImageNames = getImageRangeNames(visibleImageNames, anchorImageName, normalizedImageName);
            if (isToggleSelection) {
                onReplaceSelection(mergeUniqueImageNames(selectedImageNames, rangedImageNames));
            }
            else {
                onReplaceSelection(rangedImageNames);
            }
            return;
        }
        setSelectionAnchor(normalizedImageName);
        if (isToggleSelection) {
            onToggleImageSelection(normalizedImageName);
            return;
        }
        onReplaceSelection([normalizedImageName]);
    };
    if (!open) {
        return null;
    }
    return (React.createElement("div", { className: "fixed inset-0 z-[70]" },
        React.createElement("div", { className: "absolute inset-0 bg-slate-950/55 backdrop-blur-sm", onClick: onClose, "aria-hidden": "true" }),
        React.createElement("div", { className: "relative flex h-full items-center justify-center p-3 md:p-6" },
            React.createElement("div", { className: "flex h-[min(92vh,980px)] w-[min(96vw,1540px)] flex-col overflow-hidden rounded-sm border border-slate-200 bg-base-100 shadow-2xl", onClick: (event) => event.stopPropagation() },
                React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-4 border-b border-base-300 px-5 py-4 md:px-6" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700" }, "Label otomatis dengan YOLO"),
                        React.createElement("h2", { className: "mt-2 text-2xl font-bold tracking-tight text-slate-900" }, "Auto Labeler")),
                    React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, className: "rounded-sm", onClick: onClose }, "Tutup")),
                React.createElement("div", { className: "grid min-h-0 flex-1 xl:grid-cols-[390px_minmax(0,1fr)]" },
                    React.createElement("aside", { className: "min-h-0 overflow-y-auto border-b border-base-300 bg-base-100 xl:border-b-0 xl:border-r" },
                        React.createElement("div", { className: "space-y-4 p-5" },
                            React.createElement("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-1" },
                                React.createElement("div", { className: "rounded-sm border border-base-300 bg-base-200/30 p-4" },
                                    React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700" }, "Aksi auto-label"),
                                    React.createElement("div", { className: "mt-4 grid gap-2" },
                                        React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm justify-start", disabled: !currentImageName || !modelValue.trim() || isRunning, onClick: onAutolabelCurrent }, "Auto-label frame aktif"),
                                        React.createElement(Button, { variant: "warning", isSubmit: false, className: "rounded-sm justify-start", disabled: !selectedCount || !modelValue.trim() || isRunning, onClick: onAutolabelSelection }, "Auto-label frame terpilih"),
                                        React.createElement(Button, { variant: "warning", outline: true, isSubmit: false, className: "rounded-sm justify-start", disabled: !totalImages || !modelValue.trim() || isRunning, onClick: onAutolabelAll }, "Auto-label semua frame"))),
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
                                                React.createElement("p", { className: "font-medium text-slate-900" }, "Suppress nested duplicate person boxes")))),
                                    Boolean(autolabelConfig.suppressNestedDuplicates) && (React.createElement(Input, { name: "autolabel-duplicate-containment-threshold", label: "Duplicate containment threshold", type: "number", step: "0.01", min: "0.5", max: "1", helpText: "Semakin kecil nilainya, filter makin agresif menganggap dua box sebagai duplikat nested.", value: String(autolabelConfig.duplicateContainmentThreshold ?? ""), onChange: (event) => onAutolabelConfigChange({
                                            ...autolabelConfig,
                                            duplicateContainmentThreshold: event.target.value,
                                        }), disabled: isRunning })))),
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
                                    React.createElement("div", { className: "flex flex-wrap gap-2" },
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !currentImageName, onClick: handleSelectCurrentImage }, "Pilih frame aktif"),
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !visibleImages.length, onClick: handleSelectVisibleImages }, "Pilih semua terlihat"),
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !pendingVisibleImages.length, onClick: handleSelectPendingImages }, "Pilih pending"),
                                        React.createElement(Button, { variant: "ghost", outline: true, isSubmit: false, size: "sm", className: "rounded-sm", disabled: !selectedCount, onClick: handleClearVisibleSelection }, "Reset selection")),
                                    React.createElement("p", { className: "text-xs text-slate-500" }, "Klik untuk pilih satu frame, `Ctrl/Cmd + klik` untuk toggle, `Shift + klik` untuk pilih rentang, dan `Ctrl/Cmd + A` untuk memilih semua frame terlihat."))),
                            React.createElement("div", { className: "relative min-h-0 flex-1" },
                                React.createElement("div", { ref: mainbarViewportRef, className: joinClasses("h-full min-h-0 overflow-y-auto p-5", dragSelectionRect ? "cursor-crosshair" : "") }, visibleImages.length ? (React.createElement(React.Fragment, null,
                                    React.createElement("div", { className: "grid select-none gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", onMouseDown: handleGridMouseDown }, renderedVisibleImages.map((item) => {
                                        const isSelected = selectionSet.has(item.name);
                                        const isCurrent = item.name === currentImageName;
                                        const status = frameStatus(item);
                                        return (React.createElement("button", { key: item.name, "data-image-name": item.name, type: "button", "aria-pressed": isSelected, "aria-current": isCurrent ? "true" : undefined, onClick: (event) => handleImageCardClick(event, item.name), onDragStart: (event) => event.preventDefault(), ref: (node) => {
                                                if (node) {
                                                    imageCardRefs.current.set(item.name, node);
                                                    return;
                                                }
                                                imageCardRefs.current.delete(item.name);
                                            }, className: joinClasses("group overflow-hidden rounded-sm border bg-base-100 text-left transition duration-150 select-none", isSelected
                                                ? "border-warning bg-warning/10 shadow-lg ring-1 ring-warning/40"
                                                : joinClasses("border-base-300", dragSelectionRect
                                                    ? ""
                                                    : "hover:-translate-y-0.5 hover:border-base-content/20 hover:shadow-md"), isCurrent && !isSelected ? "border-info/70 ring-1 ring-info/20" : "") },
                                            React.createElement("div", { className: "relative aspect-video overflow-hidden bg-slate-200" },
                                                React.createElement("img", { src: `/frames/${encodeURIComponent(item.name)}`, alt: item.name, loading: "lazy", draggable: false, onDragStart: (event) => event.preventDefault(), className: joinClasses("pointer-events-none h-full w-full select-none object-cover transition duration-200", dragSelectionRect ? "" : "group-hover:scale-[1.02]") }),
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
                                            " frame lagi"))) : null)) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Tidak ada frame aktif yang cocok dengan filter dan pencarian saat ini."))),
                                dragSelectionRect ? (React.createElement("div", { className: "pointer-events-none absolute inset-0 z-20 overflow-hidden" },
                                    React.createElement("div", { className: "absolute rounded-sm border-2 border-warning bg-warning/20 shadow-sm", style: {
                                            left: `${dragSelectionRect.left}px`,
                                            top: `${dragSelectionRect.top}px`,
                                            width: `${dragSelectionRect.width}px`,
                                            height: `${dragSelectionRect.height}px`,
                                        } }))) : null))))))));
}
