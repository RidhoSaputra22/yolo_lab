/**
 * LabelerPage - Main YOLO image labeling tool
 *
 * Manages:
 * - Frame list and navigation (sidebar component)
 * - Canvas rendering and box drawing (canvas component)
 * - Class and tool selection (tool panel component)
 * - Header with save/checkpoint controls
 * - State management and handlers
 *
 * Folder structure:
 * - LabelerPage/LabelerSidebar.jsx - Frame browser, filters, statistics
 * - LabelerPage/LabelerCanvas.jsx - Image/canvas rendering
 * - LabelerPage/LabelerToolPanel.jsx - Tools, class selection, boxes
 * - LabelerPage/LabelerHeader.jsx - Navigation and current image info
 * - LabelerPage/constants.js - Colors, zoom levels, undo limits
 * - LabelerPage/utils.js - Utility functions for geometry, filtering, boxes
 * - LabelerPage/hooks.js - Custom React hooks for canvas geometry and zoom
 * - LabelerPage/index.js - Barrel exports
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../shared/api.js";
import { mergeJobLog, useJobEventStream } from "../shared/jobStream.js";
import { usePagePreferencesAutosave } from "../shared/pagePreferences.js";
import { useToast } from "../shared/toast.js";
import { clamp } from "../shared/utils.js";
import { LabelerSidebar, LabelerCanvas, LabelerToolPanel, LabelerHeader, LabelerAutolabelModal, LabelerLogs, BOX_COLORS, MAX_UNDO_STEPS, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL, ZOOM_WHEEL_FACTOR, createNotice, filterImages, cloneBoxes, boxesEqual, getDisplayMetricsForZoom, getStageLayoutMetrics, } from "./LabelerPage/index.js";
export default function LabelerPage() {
    // State management
    const [classNames, setClassNames] = useState([]);
    const [images, setImages] = useState([]);
    const [frameFolders, setFrameFolders] = useState([]);
    const [activeFramesDir, setActiveFramesDir] = useState("");
    const [currentImageName, setCurrentImageName] = useState(null);
    const [checkpointImageName, setCheckpointImageName] = useState(null);
    const [boxes, setBoxes] = useState([]);
    const [selectedBoxId, setSelectedBoxId] = useState(null);
    const [hasLabelFile, setHasLabelFile] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [activeClassId, setActiveClassId] = useState(0);
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    const [zoomLevel, setZoomLevel] = useState(1);
    const [filterValue, setFilterValue] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [undoStack, setUndoStack] = useState([]);
    const [imageSrc, setImageSrc] = useState("");
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [autolabelConfig, setAutolabelConfig] = useState({
        model: "",
        conf: 0.35,
        imgsz: 960,
        device: "auto",
    });
    const [autolabelSuggestions, setAutolabelSuggestions] = useState([]);
    const [autolabelWarnings, setAutolabelWarnings] = useState([]);
    const [autolabelJob, setAutolabelJob] = useState(null);
    const [isAutolabelModalOpen, setIsAutolabelModalOpen] = useState(false);
    const [isPreferenceReady, setIsPreferenceReady] = useState(false);
    // Refs for imperative updates and event handling
    const nextBoxIdRef = useRef(1);
    const loadTokenRef = useRef(0);
    const stageViewportRef = useRef(null);
    const frameShellRef = useRef(null);
    const overlayRef = useRef(null);
    const dirtyRef = useRef(dirty);
    const boxesRef = useRef(boxes);
    const selectedBoxIdRef = useRef(selectedBoxId);
    const activeClassIdRef = useRef(activeClassId);
    const interactionRef = useRef(null);
    const currentImageNameRef = useRef(currentImageName);
    const naturalSizeRef = useRef(naturalSize);
    const stageSizeRef = useRef(stageSize);
    const zoomLevelRef = useRef(zoomLevel);
    const undoStackRef = useRef(undoStack);
    const imagesRef = useRef(images);
    const draftBoxesRef = useRef(null);
    const overlayFrameRef = useRef(0);
    const preferencesHydratedRef = useRef(false);
    const previousAutolabelRunningRef = useRef(false);
    const { setNotice } = useToast();
    // Sync refs with state
    useEffect(() => {
        dirtyRef.current = dirty;
    }, [dirty]);
    useEffect(() => {
        boxesRef.current = boxes;
    }, [boxes]);
    useEffect(() => {
        selectedBoxIdRef.current = selectedBoxId;
    }, [selectedBoxId]);
    useEffect(() => {
        activeClassIdRef.current = activeClassId;
    }, [activeClassId]);
    useEffect(() => {
        currentImageNameRef.current = currentImageName;
    }, [currentImageName]);
    useEffect(() => {
        naturalSizeRef.current = naturalSize;
    }, [naturalSize]);
    useEffect(() => {
        stageSizeRef.current = stageSize;
    }, [stageSize]);
    useEffect(() => {
        zoomLevelRef.current = zoomLevel;
    }, [zoomLevel]);
    useEffect(() => {
        undoStackRef.current = undoStack;
    }, [undoStack]);
    useEffect(() => {
        imagesRef.current = images;
    }, [images]);
    useEffect(() => {
        setZoomLevel((current) => {
            const nextZoom = clamp(current, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
            zoomLevelRef.current = nextZoom;
            return nextZoom;
        });
    }, []);
    useEffect(() => () => {
        if (overlayFrameRef.current) {
            cancelAnimationFrame(overlayFrameRef.current);
        }
    }, []);
    const isLabelingLocked = Boolean(autolabelJob?.running);
    useEffect(() => {
        const viewport = stageViewportRef.current;
        if (!viewport)
            return;
        let frameId = 0;
        const measureStage = () => {
            frameId = 0;
            const style = window.getComputedStyle(viewport);
            const paddingX = Number.parseFloat(style.paddingLeft || "0") +
                Number.parseFloat(style.paddingRight || "0");
            const paddingY = Number.parseFloat(style.paddingTop || "0") +
                Number.parseFloat(style.paddingBottom || "0");
            const nextSize = {
                width: Math.max(0, Math.round(viewport.clientWidth - paddingX)),
                height: Math.max(0, Math.round(viewport.clientHeight - paddingY)),
            };
            setStageSize((current) => current.width === nextSize.width && current.height === nextSize.height
                ? current
                : nextSize);
        };
        const scheduleMeasure = () => {
            if (frameId)
                cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(measureStage);
        };
        scheduleMeasure();
        const observer = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(scheduleMeasure)
            : null;
        observer?.observe(viewport);
        window.addEventListener("resize", scheduleMeasure);
        return () => {
            if (frameId)
                cancelAnimationFrame(frameId);
            observer?.disconnect();
            window.removeEventListener("resize", scheduleMeasure);
        };
    }, [currentImageName]);
    const markDirty = (nextDirty) => {
        dirtyRef.current = nextDirty;
        setDirty(nextDirty);
    };
    const syncSelectedBoxId = (nextSelectedBoxId) => {
        selectedBoxIdRef.current = nextSelectedBoxId;
        setSelectedBoxId(nextSelectedBoxId);
    };
    // Derived state
    const visibleImages = useMemo(() => filterImages(images, filterValue, searchQuery), [images, filterValue, searchQuery]);
    const currentImageItem = useMemo(() => images.find((item) => item.name === currentImageName) || null, [images, currentImageName]);
    const selectedBox = useMemo(() => boxes.find((box) => box.id === selectedBoxId) || null, [boxes, selectedBoxId]);
    const displayMetrics = useMemo(() => getDisplayMetricsForZoom(naturalSize, stageSize, zoomLevel), [naturalSize, stageSize, zoomLevel]);
    const stageLayout = useMemo(() => getStageLayoutMetrics(displayMetrics, stageSize), [displayMetrics, stageSize]);
    const labelerPreferences = useMemo(() => ({
        framesDir: activeFramesDir || "",
        filterValue,
        searchQuery,
        activeClassId,
        autolabelConfig,
    }), [activeFramesDir, filterValue, searchQuery, activeClassId, autolabelConfig]);
    usePagePreferencesAutosave("labeler", labelerPreferences, {
        enabled: isPreferenceReady && !isLoading,
    });
    // Box ID management
    const syncNextBoxId = (nextBoxes) => {
        nextBoxIdRef.current = nextBoxes.reduce((maxId, box) => Math.max(maxId, Number(box.id) + 1), 1);
    };
    const createBox = (data) => ({
        id: data.id ?? nextBoxIdRef.current++,
        classId: Number(data.classId) || 0,
        x: Number(data.x) || 0,
        y: Number(data.y) || 0,
        width: Number(data.width) || 0,
        height: Number(data.height) || 0,
    });
    // Undo management
    const takeUndoSnapshot = () => ({
        boxes: cloneBoxes(boxesRef.current),
        selectedBoxId: selectedBoxIdRef.current,
        activeClassId: activeClassIdRef.current,
    });
    const pushUndoSnapshot = (snapshot) => {
        if (!snapshot)
            return;
        setUndoStack((current) => [
            ...current.slice(-(MAX_UNDO_STEPS - 1)),
            snapshot,
        ]);
    };
    const restoreUndoSnapshot = (snapshot) => {
        const nextBoxes = cloneBoxes(snapshot.boxes || []);
        syncNextBoxId(nextBoxes);
        setBoxes(nextBoxes);
        syncSelectedBoxId(nextBoxes.some((box) => box.id === snapshot.selectedBoxId)
            ? snapshot.selectedBoxId
            : nextBoxes[0]?.id || null);
        setActiveClassId(Number(snapshot.activeClassId) || 0);
    };
    const normalizedToBox = (item, frameSize) => {
        const width = item.width * frameSize.width;
        const height = item.height * frameSize.height;
        return createBox({
            classId: item.classId,
            x: item.cx * frameSize.width - width / 2,
            y: item.cy * frameSize.height - height / 2,
            width,
            height,
        });
    };
    const boxToPayload = (box) => ({
        classId: box.classId,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
    });
    const getLabelApiUrl = (name) => `/api/labels?image=${encodeURIComponent(name)}`;
    const syncCheckpointState = (nextImages, checkpointName) => {
        const normalized = typeof checkpointName === "string" ? checkpointName.trim() : "";
        let checkpointExists = false;
        const updatedImages = nextImages.map((item) => ({
            ...item,
            isCheckpoint: item.name === normalized,
        }));
        updatedImages.forEach((item) => {
            if (item.isCheckpoint)
                checkpointExists = true;
        });
        setImages(updatedImages);
        setCheckpointImageName(checkpointExists ? normalized : null);
        return updatedImages;
    };
    // Frame loading
    const loadFrameInfo = (name) => new Promise((resolve, reject) => {
        const image = new Image();
        const src = `/frames/${encodeURIComponent(name)}`;
        image.onload = () => {
            setNaturalSize({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
            setImageSrc(src);
            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        };
        image.onerror = () => {
            reject(new Error(`Failed to load frame: ${name}`));
        };
        image.src = src;
    });
    const selectImage = async (name, { force = false } = {}) => {
        if (!force && isLabelingLocked) {
            setNotice(createNotice("warning", "Tunggu auto-label selesai sebelum pindah frame."));
            return;
        }
        if (!force && dirtyRef.current) {
            setNotice(createNotice("warning", "Frame belum disimpan. Klik tombol Simpan terlebih dahulu."));
            return;
        }
        const requestToken = loadTokenRef.current + 1;
        loadTokenRef.current = requestToken;
        setNotice(createNotice("info", "Memuat frame dan label..."));
        try {
            const [frameInfo, labelData] = await Promise.all([
                loadFrameInfo(name),
                fetchJson(getLabelApiUrl(name)),
            ]);
            if (requestToken !== loadTokenRef.current)
                return;
            setHasLabelFile(Boolean(labelData?.hasLabelFile));
            setParseError(labelData?.parseError || null);
            setCurrentImageName(name);
            markDirty(false);
            interactionRef.current = null;
            draftBoxesRef.current = null;
            setBoxes([]);
            syncSelectedBoxId(null);
            setUndoStack([]);
            if (labelData?.boxes?.length) {
                const nextBoxes = labelData.boxes
                    .map((item) => normalizedToBox(item, frameInfo))
                    .filter((box) => box.width > 0 && box.height > 0);
                syncNextBoxId(nextBoxes);
                setBoxes(nextBoxes);
                syncSelectedBoxId(nextBoxes[0]?.id || null);
            }
            setNotice(null);
        }
        catch (error) {
            if (requestToken === loadTokenRef.current) {
                setNotice(createNotice("error", error.message));
            }
        }
    };
    const reloadConfig = async (preserveSelection = true) => {
        setIsLoading(true);
        try {
            const config = await fetchJson("/api/config");
            const checkpointName = config.checkpointImage || null;
            const autolabelDefaults = config.autolabel?.defaults || {};
            const pagePreferences = config.preferences || {};
            setClassNames(config.classNames || []);
            setCheckpointImageName(checkpointName);
            setFrameFolders(config.frameFolders || []);
            setActiveFramesDir(config.activeFramesDir || "");
            if (!preferencesHydratedRef.current) {
                setFilterValue(typeof pagePreferences.filterValue === "string" && pagePreferences.filterValue
                    ? pagePreferences.filterValue
                    : "all");
                setSearchQuery(typeof pagePreferences.searchQuery === "string" ? pagePreferences.searchQuery : "");
                setActiveClassId(Number.isFinite(Number(pagePreferences.activeClassId))
                    ? Number(pagePreferences.activeClassId)
                    : 0);
                setAutolabelConfig({
                    ...autolabelDefaults,
                    ...(pagePreferences.autolabelConfig || {}),
                });
                preferencesHydratedRef.current = true;
                setIsPreferenceReady(true);
            }
            else {
                setAutolabelConfig((current) => preserveSelection
                    ? { ...autolabelDefaults, ...current }
                    : { ...current, ...autolabelDefaults });
            }
            setAutolabelSuggestions(config.autolabel?.suggestions?.model || []);
            setAutolabelWarnings(config.autolabel?.runtimeWarnings || []);
            setAutolabelJob(config.autolabel?.job || null);
            const nextImages = (config.images || []).map((item) => ({
                ...item,
                isCheckpoint: item.name === checkpointName,
            }));
            setImages(nextImages);
            if (preserveSelection && currentImageNameRef.current) {
                const stillExists = nextImages.some((item) => item.name === currentImageNameRef.current);
                if (stillExists)
                    return { config, images: nextImages };
            }
            if (nextImages.length) {
                await selectImage(nextImages[0].name);
            }
            else {
                setCurrentImageName(null);
                setBoxes([]);
            }
            return { config, images: nextImages };
        }
        catch (error) {
            setNotice(createNotice("error", error.message));
            return null;
        }
        finally {
            setIsLoading(false);
        }
    };
    const changeFramesDirectory = async (nextFramesDir) => {
        const normalizedDir = String(nextFramesDir || "").trim();
        if (!normalizedDir || normalizedDir === activeFramesDir) {
            return;
        }
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Tunggu auto-label selesai sebelum pindah folder."));
            return;
        }
        if (dirtyRef.current) {
            setNotice(createNotice("warning", "Frame aktif punya perubahan yang belum disimpan. Simpan dulu sebelum pindah folder."));
            return;
        }
        setNotice(createNotice("info", "Memindahkan labeler ke folder frame terpilih..."));
        try {
            await fetchJson("/api/frames/activate", {
                method: "POST",
                body: JSON.stringify({ framesDir: normalizedDir }),
            });
            await reloadConfig(false);
            setNotice(createNotice("success", `Folder frame aktif diganti ke ${normalizedDir}.`));
        }
        catch (error) {
            setNotice(createNotice("error", error.message));
        }
    };
    const navigate = (step) => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Navigasi frame dikunci saat auto-label berjalan."));
            return;
        }
        if (!visibleImages.length) {
            setNotice(createNotice("warning", "Tidak ada frame yang tersedia."));
            return;
        }
        const currentIndex = visibleImages.findIndex((item) => item.name === currentImageNameRef.current);
        const nextIndex = clamp(currentIndex < 0
            ? step > 0
                ? 0
                : visibleImages.length - 1
            : currentIndex + step, 0, visibleImages.length - 1);
        const nextItem = visibleImages[nextIndex];
        if (nextItem && nextItem.name !== currentImageNameRef.current) {
            void selectImage(nextItem.name);
        }
    };
    const saveCurrentLabel = async (advance = false) => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Simpan label dinonaktifkan sampai auto-label selesai."));
            return;
        }
        if (!currentImageNameRef.current) {
            setNotice(createNotice("warning", "Tidak ada frame yang aktif."));
            return;
        }
        try {
            const imageName = currentImageNameRef.current;
            const payload = {
                imageWidth: naturalSizeRef.current.width,
                imageHeight: naturalSizeRef.current.height,
                boxes: boxesRef.current.map(boxToPayload),
            };
            const response = await fetchJson(getLabelApiUrl(imageName), {
                method: "POST",
                body: JSON.stringify(payload),
            });
            markDirty(false);
            setHasLabelFile(true);
            setParseError(null);
            setImages((current) => current.map((item) => item.name === imageName
                ? {
                    ...item,
                    hasLabelFile: true,
                    boxCount: Number(response.boxCount || 0),
                }
                : item));
            setNotice(createNotice("success", "Label tersimpan."));
            if (advance)
                navigate(1);
        }
        catch (error) {
            setNotice(createNotice("error", error.message));
        }
    };
    const saveCheckpoint = async (name = currentImageNameRef.current) => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Checkpoint dinonaktifkan saat auto-label berjalan."));
            return;
        }
        if (!name) {
            setNotice(createNotice("warning", "Frame harus dipilih untuk membuat checkpoint."));
            return;
        }
        try {
            const response = await fetchJson("/api/checkpoint", {
                method: "POST",
                body: JSON.stringify({ image: name }),
            });
            syncCheckpointState(imagesRef.current, response.checkpointImage || name);
            setNotice(createNotice("success", "Checkpoint tersimpan."));
        }
        catch (error) {
            setNotice(createNotice("error", error.message));
        }
    };
    const openCheckpoint = () => {
        if (!checkpointImageName) {
            setNotice(createNotice("warning", "Checkpoint belum diatur."));
            return;
        }
        if (checkpointImageName === currentImageNameRef.current) {
            setNotice(createNotice("info", "Frame ini adalah checkpoint aktif."));
            return;
        }
        void selectImage(checkpointImageName);
    };
    const removeBox = (boxId) => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Edit bounding box dikunci saat auto-label berjalan."));
            return;
        }
        const currentBoxes = boxesRef.current;
        const nextBoxes = currentBoxes.filter((box) => box.id !== boxId);
        if (nextBoxes.length === currentBoxes.length)
            return;
        pushUndoSnapshot(takeUndoSnapshot());
        syncNextBoxId(nextBoxes);
        setBoxes(nextBoxes);
        syncSelectedBoxId(nextBoxes[0]?.id || null);
        markDirty(true);
    };
    const clearAllBoxes = () => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Edit bounding box dikunci saat auto-label berjalan."));
            return;
        }
        if (!boxesRef.current.length)
            return;
        pushUndoSnapshot(takeUndoSnapshot());
        setBoxes([]);
        syncSelectedBoxId(null);
        markDirty(true);
    };
    const undoLastChange = () => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Undo dinonaktifkan saat auto-label berjalan."));
            return;
        }
        if (!undoStackRef.current.length) {
            setNotice(createNotice("warning", "Tidak ada perubahan untuk dibatalkan."));
            return;
        }
        const nextStack = [...undoStackRef.current];
        const snapshot = nextStack.pop();
        setUndoStack(nextStack);
        restoreUndoSnapshot(snapshot);
        markDirty(true);
        setNotice(createNotice("info", "Perubahan terakhir dibatalkan."));
    };
    const syncSelectedBoxClass = (nextClassId) => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Perubahan class dikunci saat auto-label berjalan."));
            return;
        }
        const parsedClassId = Number(nextClassId) || 0;
        setActiveClassId(parsedClassId);
        const selected = boxesRef.current.find((box) => box.id === selectedBoxIdRef.current);
        if (!selected || selected.classId === parsedClassId)
            return;
        pushUndoSnapshot(takeUndoSnapshot());
        const nextBoxes = boxesRef.current.map((box) => box.id === selected.id ? { ...box, classId: parsedClassId } : box);
        setBoxes(nextBoxes);
        markDirty(true);
    };
    const resetZoom = () => {
        zoomLevelRef.current = 1;
        setZoomLevel(1);
        if (stageViewportRef.current) {
            stageViewportRef.current.scrollLeft = 0;
            stageViewportRef.current.scrollTop = 0;
        }
    };
    const zoomAtViewportPoint = (getNextZoom, anchorClientPoint = null) => {
        const viewport = stageViewportRef.current;
        const frameShell = frameShellRef.current;
        const currentNaturalSize = naturalSizeRef.current;
        const currentStageSize = stageSizeRef.current;
        if (!viewport ||
            !frameShell ||
            !currentNaturalSize.width ||
            !currentNaturalSize.height ||
            !currentStageSize.width ||
            !currentStageSize.height) {
            return;
        }
        const viewportRect = viewport.getBoundingClientRect();
        const frameRect = frameShell.getBoundingClientRect();
        const currentZoom = zoomLevelRef.current;
        const anchorX = anchorClientPoint?.x ?? viewportRect.left + viewport.clientWidth / 2;
        const anchorY = anchorClientPoint?.y ?? viewportRect.top + viewport.clientHeight / 2;
        const currentScaleX = frameRect.width / currentNaturalSize.width;
        const currentScaleY = frameRect.height / currentNaturalSize.height;
        const imagePointX = clamp((anchorX - frameRect.left) / currentScaleX, 0, currentNaturalSize.width);
        const imagePointY = clamp((anchorY - frameRect.top) / currentScaleY, 0, currentNaturalSize.height);
        const nextZoom = clamp(getNextZoom(currentZoom), MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
        if (Math.abs(nextZoom - currentZoom) < 0.0001) {
            return;
        }
        zoomLevelRef.current = nextZoom;
        setZoomLevel(nextZoom);
        requestAnimationFrame(() => {
            const nextViewport = stageViewportRef.current;
            if (!nextViewport) {
                return;
            }
            const nextDisplayMetrics = getDisplayMetricsForZoom(currentNaturalSize, currentStageSize, nextZoom);
            const nextStageLayout = getStageLayoutMetrics(nextDisplayMetrics, currentStageSize);
            const nextScaleX = nextDisplayMetrics.width / currentNaturalSize.width;
            const nextScaleY = nextDisplayMetrics.height / currentNaturalSize.height;
            const maxScrollLeft = Math.max(0, nextStageLayout.contentWidth - nextViewport.clientWidth);
            const maxScrollTop = Math.max(0, nextStageLayout.contentHeight - nextViewport.clientHeight);
            nextViewport.scrollLeft = clamp(nextStageLayout.frameOffsetX +
                imagePointX * nextScaleX -
                (anchorX - viewportRect.left), 0, maxScrollLeft);
            nextViewport.scrollTop = clamp(nextStageLayout.frameOffsetY +
                imagePointY * nextScaleY -
                (anchorY - viewportRect.top), 0, maxScrollTop);
        });
    };
    const zoomFromViewportCenter = (direction) => {
        zoomAtViewportPoint((currentZoom) => currentZoom *
            (direction > 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR));
    };
    const zoomIn = () => {
        zoomFromViewportCenter(1);
    };
    const zoomOut = () => {
        zoomFromViewportCenter(-1);
    };
    const handleAutolabelCurrent = async () => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Masih ada proses auto-label yang berjalan."));
            return;
        }
        if (!currentImageNameRef.current) {
            setNotice(createNotice("warning", "Tidak ada frame aktif untuk auto-label."));
            return;
        }
        if (!String(autolabelConfig.model || "").trim()) {
            setNotice(createNotice("warning", "Model auto-label wajib diisi."));
            return;
        }
        if (dirtyRef.current) {
            setNotice(createNotice("warning", "Simpan perubahan frame aktif terlebih dahulu sebelum menjalankan auto-label."));
            return;
        }
        const imageName = currentImageNameRef.current;
        try {
            const nextJob = await fetchJson("/api/autolabel", {
                method: "POST",
                body: JSON.stringify({
                    image: imageName,
                    ...autolabelConfig,
                }),
            });
            setAutolabelJob(nextJob);
            setIsAutolabelModalOpen(false);
            setNotice(createNotice("info", "Auto-label frame dimulai. Panel labeling dikunci sampai selesai."));
        }
        catch (error) {
            setNotice(createNotice("error", error.message));
        }
    };
    const handleAutolabelAll = async () => {
        if (isLabelingLocked) {
            setNotice(createNotice("warning", "Masih ada proses auto-label yang berjalan."));
            return;
        }
        if (!imagesRef.current.length) {
            setNotice(createNotice("warning", "Folder frame aktif belum memiliki frame."));
            return;
        }
        if (!String(autolabelConfig.model || "").trim()) {
            setNotice(createNotice("warning", "Model auto-label wajib diisi."));
            return;
        }
        if (dirtyRef.current) {
            setNotice(createNotice("warning", "Simpan perubahan frame aktif terlebih dahulu sebelum auto-label semua frame."));
            return;
        }
        const confirmed = window.confirm("Jalankan auto-label untuk semua frame pada folder aktif? Label yang sudah ada akan dipertahankan.");
        if (!confirmed) {
            return;
        }
        try {
            const nextJob = await fetchJson("/api/autolabel/all", {
                method: "POST",
                body: JSON.stringify(autolabelConfig),
            });
            setAutolabelJob(nextJob);
            setIsAutolabelModalOpen(false);
            setNotice(createNotice("info", `Auto-label semua frame dimulai untuk ${imagesRef.current.length} frame. Panel labeling dikunci sampai selesai.`));
        }
        catch (error) {
            setNotice(createNotice("error", error.message));
        }
    };
    const toImagePointFromEvent = (event) => {
        const canvas = overlayRef.current;
        const currentNaturalSize = naturalSizeRef.current;
        if (!canvas ||
            !frameShellRef.current ||
            !displayMetrics.width ||
            !displayMetrics.height ||
            !currentNaturalSize.width ||
            !currentNaturalSize.height) {
            return { x: 0, y: 0 };
        }
        const frameRect = frameShellRef.current.getBoundingClientRect();
        return {
            x: clamp(((event.clientX - frameRect.left) / displayMetrics.width) *
                currentNaturalSize.width, 0, currentNaturalSize.width),
            y: clamp(((event.clientY - frameRect.top) / displayMetrics.height) *
                currentNaturalSize.height, 0, currentNaturalSize.height),
        };
    };
    const isPointInsideBox = (point, box) => point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height;
    const getHandleHit = (point, box) => {
        const threshold = 8;
        const hitH = (v) => Math.abs(point.y - v) < threshold;
        const hitV = (v) => Math.abs(point.x - v) < threshold;
        if (hitV(box.x) && hitH(box.y))
            return "nw";
        if (hitV(box.x + box.width) && hitH(box.y))
            return "ne";
        if (hitV(box.x) && hitH(box.y + box.height))
            return "sw";
        if (hitV(box.x + box.width) && hitH(box.y + box.height))
            return "se";
        return null;
    };
    const findInteractionTarget = (point) => {
        for (let i = boxesRef.current.length - 1; i >= 0; i--) {
            const box = boxesRef.current[i];
            if (isPointInsideBox(point, box)) {
                return { boxId: box.id, handle: getHandleHit(point, box) };
            }
        }
        return null;
    };
    const getCursorForPoint = (point) => {
        const target = findInteractionTarget(point);
        if (!target)
            return "crosshair";
        if (target.handle === "nw" || target.handle === "se")
            return "nwse-resize";
        if (target.handle === "ne" || target.handle === "sw")
            return "nesw-resize";
        return "move";
    };
    const normalizeRect = (start, end) => ({
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
    });
    const getMovedBox = (startBox, delta) => ({
        ...startBox,
        x: clamp(startBox.x + delta.x, 0, Math.max(0, naturalSizeRef.current.width - startBox.width)),
        y: clamp(startBox.y + delta.y, 0, Math.max(0, naturalSizeRef.current.height - startBox.height)),
    });
    const getResizedBox = (interactionState, delta) => {
        const currentNaturalSize = naturalSizeRef.current;
        const startBox = interactionState.startBox;
        let left = startBox.x;
        let top = startBox.y;
        let right = startBox.x + startBox.width;
        let bottom = startBox.y + startBox.height;
        if (interactionState.handle?.includes("w")) {
            left = clamp(left + delta.x, 0, currentNaturalSize.width);
        }
        if (interactionState.handle?.includes("e")) {
            right = clamp(right + delta.x, 0, currentNaturalSize.width);
        }
        if (interactionState.handle?.includes("n")) {
            top = clamp(top + delta.y, 0, currentNaturalSize.height);
        }
        if (interactionState.handle?.includes("s")) {
            bottom = clamp(bottom + delta.y, 0, currentNaturalSize.height);
        }
        return {
            ...startBox,
            x: Math.min(left, right),
            y: Math.min(top, bottom),
            width: Math.abs(right - left),
            height: Math.abs(bottom - top),
        };
    };
    const drawOverlay = () => {
        const svg = overlayRef.current;
        if (!svg || !frameShellRef.current || !displayMetrics.width || !displayMetrics.height) {
            return;
        }
        if (!naturalSizeRef.current.width || !naturalSizeRef.current.height) {
            return;
        }
        const currentNaturalSize = naturalSizeRef.current;
        const renderedBoxes = draftBoxesRef.current || boxesRef.current;
        const interactionState = interactionRef.current;
        const scaleX = displayMetrics.width / currentNaturalSize.width;
        const scaleY = displayMetrics.height / currentNaturalSize.height;
        const handleSize = 8;
        const shapes = [];
        const drawBoxMarkup = (box, isSelected) => {
            const color = BOX_COLORS[box.classId % BOX_COLORS.length];
            const x = box.x * scaleX;
            const y = box.y * scaleY;
            const w = box.width * scaleX;
            const h = box.height * scaleY;
            const lineWidth = isSelected ? 3 : 2;
            if (isSelected) {
                shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.2" stroke="none" />`);
            }
            shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${lineWidth}" />`);
            if (isSelected) {
                [
                    [x, y],
                    [x + w, y],
                    [x, y + h],
                    [x + w, y + h],
                ].forEach(([hx, hy]) => {
                    shapes.push(`<rect x="${hx - handleSize / 2}" y="${hy - handleSize / 2}" width="${handleSize}" height="${handleSize}" fill="${color}" stroke="none" />`);
                });
            }
        };
        renderedBoxes.forEach((box) => drawBoxMarkup(box, box.id === selectedBoxIdRef.current));
        if (interactionState?.type === "draw") {
            const start = interactionState.startPoint;
            const end = interactionState.endPoint;
            const sx = start.x * scaleX;
            const sy = start.y * scaleY;
            const ex = end.x * scaleX;
            const ey = end.y * scaleY;
            shapes.push(`<rect x="${Math.min(sx, ex)}" y="${Math.min(sy, ey)}" width="${Math.abs(ex - sx)}" height="${Math.abs(ey - sy)}" fill="none" stroke="#3b82f6" stroke-width="2" />`);
        }
        svg.innerHTML = shapes.join("");
    };
    const scheduleOverlayDraw = () => {
        if (overlayFrameRef.current) {
            return;
        }
        overlayFrameRef.current = requestAnimationFrame(() => {
            overlayFrameRef.current = 0;
            drawOverlay();
        });
    };
    const handleCanvasMouseDown = (event) => {
        if (isLabelingLocked) {
            return;
        }
        if (!currentImageNameRef.current)
            return;
        event.preventDefault();
        const point = toImagePointFromEvent(event);
        const target = findInteractionTarget(point);
        if (target) {
            syncSelectedBoxId(target.boxId);
            interactionRef.current = {
                type: target.handle ? "resize" : "move",
                boxId: target.boxId,
                handle: target.handle,
                startPoint: point,
                startBox: {
                    ...boxesRef.current.find((b) => b.id === target.boxId),
                },
            };
            draftBoxesRef.current = cloneBoxes(boxesRef.current);
        }
        else {
            syncSelectedBoxId(null);
            interactionRef.current = {
                type: "draw",
                startPoint: point,
                endPoint: point,
            };
            draftBoxesRef.current = null;
        }
        scheduleOverlayDraw();
    };
    // Canvas drawing and interaction
    useEffect(() => {
        scheduleOverlayDraw();
    }, [boxes, selectedBoxId, displayMetrics.width, displayMetrics.height, currentImageName]);
    useEffect(() => {
        if (!overlayRef.current)
            return;
        const canvas = overlayRef.current;
        const handleHoverMove = (event) => {
            if (interactionRef.current || !currentImageNameRef.current) {
                return;
            }
            canvas.style.cursor = getCursorForPoint(toImagePointFromEvent(event));
        };
        const handleWindowMouseMove = (event) => {
            const interactionState = interactionRef.current;
            if (!interactionState) {
                return;
            }
            const point = toImagePointFromEvent(event);
            if (interactionState.type === "draw") {
                interactionRef.current = {
                    ...interactionState,
                    endPoint: point,
                };
            }
            else if (interactionState.type === "move" && interactionState.startBox) {
                const delta = {
                    x: point.x - interactionState.startPoint.x,
                    y: point.y - interactionState.startPoint.y,
                };
                const updated = getMovedBox(interactionState.startBox, delta);
                draftBoxesRef.current = boxesRef.current.map((box) => box.id === interactionState.boxId ? updated : { ...box });
            }
            else if (interactionState.type === "resize" && interactionState.startBox) {
                const delta = {
                    x: point.x - interactionState.startPoint.x,
                    y: point.y - interactionState.startPoint.y,
                };
                const updated = getResizedBox(interactionState, delta);
                draftBoxesRef.current = boxesRef.current.map((box) => box.id === interactionState.boxId ? updated : { ...box });
            }
            scheduleOverlayDraw();
        };
        const handleWindowMouseUp = () => {
            const interactionState = interactionRef.current;
            if (!interactionState) {
                return;
            }
            if (interactionState.type === "draw") {
                const rect = normalizeRect(interactionState.startPoint, interactionState.endPoint);
                if (rect.width > 5 && rect.height > 5) {
                    const newBox = createBox({
                        classId: activeClassIdRef.current,
                        ...rect,
                    });
                    pushUndoSnapshot(takeUndoSnapshot());
                    setBoxes((current) => [...current, newBox]);
                    syncSelectedBoxId(newBox.id);
                    markDirty(true);
                }
            }
            else if (draftBoxesRef.current &&
                !boxesEqual(draftBoxesRef.current, boxesRef.current)) {
                pushUndoSnapshot(takeUndoSnapshot());
                setBoxes(cloneBoxes(draftBoxesRef.current));
                markDirty(true);
            }
            interactionRef.current = null;
            draftBoxesRef.current = null;
            canvas.style.cursor = "crosshair";
            scheduleOverlayDraw();
        };
        canvas.addEventListener("mousemove", handleHoverMove);
        window.addEventListener("mousemove", handleWindowMouseMove);
        window.addEventListener("mouseup", handleWindowMouseUp);
        return () => {
            canvas.removeEventListener("mousemove", handleHoverMove);
            window.removeEventListener("mousemove", handleWindowMouseMove);
            window.removeEventListener("mouseup", handleWindowMouseUp);
        };
    }, [displayMetrics.width, displayMetrics.height, currentImageName]);
    useEffect(() => {
        const viewport = stageViewportRef.current;
        if (!viewport) {
            return undefined;
        }
        const handleViewportWheel = (event) => {
            if ((!event.ctrlKey && !event.metaKey) || !currentImageNameRef.current) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            zoomAtViewportPoint((currentZoom) => currentZoom *
                (event.deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR), { x: event.clientX, y: event.clientY });
        };
        viewport.addEventListener("wheel", handleViewportWheel, {
            passive: false,
        });
        return () => {
            viewport.removeEventListener("wheel", handleViewportWheel);
        };
    }, [zoomLevel, currentImageName, naturalSize, stageSize]);
    // Keyboard shortcuts
    useEffect(() => {
        if (!currentImageName)
            return;
        if (isLabelingLocked)
            return;
        const handleKeyDown = (event) => {
            const target = event.target;
            const isTypingField = target instanceof HTMLElement &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);
            if (isTypingField) {
                return;
            }
            if (event.ctrlKey || event.metaKey) {
                if (event.key === "z" || event.key === "Z") {
                    event.preventDefault();
                    undoLastChange();
                }
                else if (event.key === "s" || event.key === "S") {
                    event.preventDefault();
                    void saveCurrentLabel(false);
                }
                else if (event.key === "0") {
                    event.preventDefault();
                    resetZoom();
                }
                return;
            }
            if ((event.key === "Delete" || event.key === "Backspace") &&
                selectedBoxIdRef.current != null) {
                if (event.repeat) {
                    return;
                }
                event.preventDefault();
                removeBox(selectedBoxIdRef.current);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [currentImageName, isLabelingLocked]);
    // Initialize on mount
    useEffect(() => {
        void reloadConfig(false);
    }, []);
    useJobEventStream("/api/autolabel/stream", {
        onSnapshot: (nextJob) => {
            setAutolabelJob(nextJob);
        },
        onLog: (event) => {
            setAutolabelJob((current) => mergeJobLog(current, event));
        },
    });
    useEffect(() => {
        const delay = autolabelJob?.running ? 1500 : 5000;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const nextJob = await fetchJson("/api/autolabel/status");
                if (!cancelled) {
                    setAutolabelJob(nextJob);
                }
            }
            catch (error) {
                if (!cancelled) {
                    setNotice(createNotice("error", error.message));
                }
            }
        }, delay);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [autolabelJob?.running, autolabelJob?.jobId, autolabelJob?.state]);
    useEffect(() => {
        const wasRunning = previousAutolabelRunningRef.current;
        const isRunning = Boolean(autolabelJob?.running);
        previousAutolabelRunningRef.current = isRunning;
        if (!wasRunning || isRunning || !autolabelJob?.jobId) {
            return;
        }
        const activeImageName = currentImageNameRef.current;
        void (async () => {
            const refreshedConfig = await reloadConfig(true);
            const refreshedImages = refreshedConfig?.images || [];
            if (activeImageName && refreshedImages.some((item) => item.name === activeImageName)) {
                await selectImage(activeImageName, { force: true });
            }
            if (autolabelJob.state === "finished") {
                const successMessage = autolabelJob.targetMode === "current"
                    ? `Auto-label frame ${autolabelJob.targetImage || ""} selesai.`
                    : "Auto-label semua frame selesai. Cek log runner untuk detail output.";
                setNotice(createNotice("success", successMessage.trim()));
            }
            else if (autolabelJob.state === "failed") {
                setNotice(createNotice("error", autolabelJob.error || "Auto-label gagal dijalankan."));
            }
            else if (autolabelJob.state === "stopped") {
                setNotice(createNotice("warning", "Proses auto-label dihentikan."));
            }
        })();
    }, [
        autolabelJob?.running,
        autolabelJob?.jobId,
        autolabelJob?.state,
        autolabelJob?.targetMode,
        autolabelJob?.targetImage,
        autolabelJob?.error,
    ]);
    // Computed values
    const currentIsCheckpoint = Boolean(currentImageItem && currentImageItem.name === checkpointImageName);
    const currentIndex = visibleImages.findIndex((item) => item.name === currentImageName);
    const zoomLabel = currentImageName
        ? Math.abs(zoomLevel - 1) < 0.001
            ? "Fit"
            : `${Math.round(zoomLevel * 100)}%`
        : "-";
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "grid h-full min-h-0 gap-4 grid-rows-[minmax(280px,42vh)_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1", style: {
                height: "calc(100% - var(--yolo-log-dock-height, 0px))",
            } },
            React.createElement("aside", { className: "min-h-0 h-[550px] overflow-y-scroll pr-1" },
                React.createElement("div", { className: "grid gap-4" },
                    React.createElement(LabelerHeader, { currentImageItem: currentImageItem, visibleImages: visibleImages, hasFrames: images.length > 0, interactionLocked: isLabelingLocked, currentIndex: currentIndex, currentIsCheckpoint: currentIsCheckpoint, checkpointImageName: checkpointImageName, naturalSize: naturalSize, zoomLabel: zoomLabel, onNavigate: navigate, onOpenCheckpoint: openCheckpoint, onSaveCheckpoint: saveCheckpoint, onOpenAutolabelModal: () => setIsAutolabelModalOpen(true), onSaveLabel: () => saveCurrentLabel(false), onSaveLabelAndNext: () => saveCurrentLabel(true) }),
                    React.createElement(LabelerSidebar, { images: images, visibleImages: visibleImages, activeFramesDir: activeFramesDir, frameFolders: frameFolders, filterValue: filterValue, searchQuery: searchQuery, isLoading: isLoading, disabled: isLabelingLocked, onFramesDirChange: changeFramesDirectory, onFilterChange: setFilterValue, onSearchChange: setSearchQuery, onRefresh: () => reloadConfig(true), onImageSelect: selectImage, currentImageName: currentImageName }),
                    React.createElement(LabelerToolPanel, { classNames: classNames, boxes: boxes, selectedBox: selectedBox, selectedBoxId: selectedBoxId, activeClassId: activeClassId, dirty: dirty, hasLabelFile: hasLabelFile, parseError: parseError, undoStack: undoStack, zoomLabel: zoomLabel, currentImageName: currentImageName, currentIsCheckpoint: currentIsCheckpoint, checkpointImageName: checkpointImageName, disabled: isLabelingLocked, onSyncSelectedBoxClass: syncSelectedBoxClass, onUndo: undoLastChange, onRemoveBox: removeBox, onClearAllBoxes: clearAllBoxes, onReloadLabel: () => selectImage(currentImageNameRef.current || "", {
                            force: true,
                        }), onBoxSelect: syncSelectedBoxId }))),
            React.createElement("section", { className: "min-h-0" },
                React.createElement(LabelerCanvas, { currentImageName: currentImageName, imageSrc: imageSrc, stageViewportRef: stageViewportRef, frameShellRef: frameShellRef, overlayRef: overlayRef, displayMetrics: displayMetrics, stageLayout: stageLayout, zoomLabel: zoomLabel, zoomLevel: zoomLevel, minZoomLevel: MIN_ZOOM_LEVEL, maxZoomLevel: MAX_ZOOM_LEVEL, interactionDisabled: isLabelingLocked, onZoomIn: zoomIn, onZoomOut: zoomOut, onResetZoom: resetZoom, onCanvasMouseDown: handleCanvasMouseDown }))),
        React.createElement(LabelerLogs, { job: autolabelJob }),
        React.createElement(LabelerAutolabelModal, { open: isAutolabelModalOpen, onClose: () => setIsAutolabelModalOpen(false), activeFramesDir: activeFramesDir, totalImages: images.length, currentImageName: currentImageName, autolabelConfig: autolabelConfig, autolabelSuggestions: autolabelSuggestions, autolabelWarnings: autolabelWarnings, job: autolabelJob, onAutolabelConfigChange: setAutolabelConfig, onAutolabelCurrent: handleAutolabelCurrent, onAutolabelAll: handleAutolabelAll })));
}
